import { createReadStream } from "node:fs";
import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

const MAX_SINGLE_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LANGUAGE_PATTERN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

function assertSlug(slug, label) {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `${label} slug must contain lowercase letters, numbers, and single hyphens only.`,
    );
  }
}

export function getLessonVideoKey(courseSlug, moduleSlug, lessonSlug) {
  assertSlug(courseSlug, "Course");
  assertSlug(moduleSlug, "Module");
  assertSlug(lessonSlug, "Lesson");
  return `courses/${courseSlug}/${moduleSlug}/${lessonSlug}.mp4`;
}

export function getLessonCaptionsKey(
  courseSlug,
  moduleSlug,
  lessonSlug,
  language,
) {
  assertSlug(courseSlug, "Course");
  assertSlug(moduleSlug, "Module");
  assertSlug(lessonSlug, "Lesson");

  if (!LANGUAGE_PATTERN.test(language)) {
    throw new Error(
      "Caption language must be a valid language tag such as en or en-GB.",
    );
  }

  return `courses/${courseSlug}/${moduleSlug}/captions/${lessonSlug}.${language.toLowerCase()}.vtt`;
}

export function parseUploadArguments(args) {
  const options = {
    captionsPath: undefined,
    force: false,
    language: "en",
    label: "English",
  };
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--force") {
      options.force = true;
    } else if (
      argument === "--captions" ||
      argument === "--language" ||
      argument === "--label"
    ) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }

      if (argument === "--captions") options.captionsPath = value;
      if (argument === "--language") options.language = value;
      if (argument === "--label") options.label = value;
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positional.push(argument);
    }
  }

  if (positional.length !== 4) {
    throw new Error(
      "Usage: npm run video:upload -- <course-slug> <module-slug> <lesson-slug> <video.mp4> [--captions <captions.vtt>] [--language <code>] [--label <label>] [--force]",
    );
  }

  if (
    !options.captionsPath &&
    args.some((argument) => argument === "--language" || argument === "--label")
  ) {
    throw new Error("--language and --label can only be used with --captions.");
  }

  return {
    courseSlug: positional[0],
    moduleSlug: positional[1],
    lessonSlug: positional[2],
    videoPath: positional[3],
    ...options,
  };
}

export function getR2UploadConfig(env = process.env) {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = env.R2_BUCKET?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 is not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET to .env.local.",
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function getSupabaseUploadConfig(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.",
    );
  }

  return { url, serviceRoleKey };
}

async function assertMp4(videoPath) {
  if (path.extname(videoPath).toLowerCase() !== ".mp4") {
    throw new Error("Lesson videos must use the .mp4 file extension.");
  }

  const file = await open(videoPath, "r");

  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await file.read(header, 0, header.length, 0);

    if (bytesRead < 12 || header.toString("ascii", 4, 8) !== "ftyp") {
      throw new Error("The selected file does not appear to be a valid MP4 video.");
    }
  } finally {
    await file.close();
  }
}

async function assertWebVtt(captionsPath) {
  if (path.extname(captionsPath).toLowerCase() !== ".vtt") {
    throw new Error("Lesson captions must use the .vtt file extension.");
  }

  const contents = await readFile(captionsPath, "utf8");
  if (!contents.trimStart().startsWith("WEBVTT")) {
    throw new Error("The selected captions file is not valid WebVTT.");
  }
}

function isMissingObject(error) {
  return (
    error?.$metadata?.httpStatusCode === 404 ||
    error?.name === "NotFound" ||
    error?.name === "NoSuchKey"
  );
}

async function assertObjectDoesNotExist(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    throw new Error(
      `An R2 object already exists at ${key}. Pass --force to replace it.`,
    );
  } catch (error) {
    if (!isMissingObject(error)) {
      throw error;
    }
  }
}

export async function uploadLessonVideo({
  courseSlug,
  moduleSlug,
  lessonSlug,
  videoPath,
  captionsPath,
  language = "en",
  label = "English",
  force = false,
}) {
  const key = getLessonVideoKey(courseSlug, moduleSlug, lessonSlug);
  const captionsKey = captionsPath
    ? getLessonCaptionsKey(courseSlug, moduleSlug, lessonSlug, language)
    : undefined;
  const absoluteVideoPath = path.resolve(videoPath);
  const fileStats = await stat(absoluteVideoPath);

  if (!fileStats.isFile()) {
    throw new Error("The supplied video path is not a file.");
  }
  if (fileStats.size === 0) {
    throw new Error("The selected video is empty.");
  }
  if (fileStats.size > MAX_SINGLE_UPLOAD_BYTES) {
    throw new Error("The selected video exceeds the 5 GiB single-upload limit.");
  }
  await assertMp4(absoluteVideoPath);

  const absoluteCaptionsPath = captionsPath
    ? path.resolve(captionsPath)
    : undefined;
  let captionsStats;

  if (absoluteCaptionsPath) {
    captionsStats = await stat(absoluteCaptionsPath);
    if (!captionsStats.isFile() || captionsStats.size === 0) {
      throw new Error("The supplied captions path must be a non-empty file.");
    }
    await assertWebVtt(absoluteCaptionsPath);
  }

  const env = getR2UploadConfig();
  const supabaseEnv = getSupabaseUploadConfig();
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });

  if (!force) {
    await assertObjectDoesNotExist(client, env.bucket, key);
    if (captionsKey) {
      await assertObjectDoesNotExist(client, env.bucket, captionsKey);
    }
  }

  await client.send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: key,
      Body: createReadStream(absoluteVideoPath),
      ContentLength: fileStats.size,
      ContentType: "video/mp4",
      Metadata: {
        "course-slug": courseSlug,
        "module-slug": moduleSlug,
        "lesson-slug": lessonSlug,
      },
    }),
  );

  if (absoluteCaptionsPath && captionsKey && captionsStats) {
    await client.send(
      new PutObjectCommand({
        Bucket: env.bucket,
        Key: captionsKey,
        Body: createReadStream(absoluteCaptionsPath),
        ContentLength: captionsStats.size,
        ContentType: "text/vtt; charset=utf-8",
        Metadata: {
          "course-slug": courseSlug,
          "module-slug": moduleSlug,
          "lesson-slug": lessonSlug,
          language: language.toLowerCase(),
        },
      }),
    );
  }

  const supabase = createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const metadata = {
    lesson_slug: lessonSlug,
    video_key: key,
    is_available: true,
    updated_at: new Date().toISOString(),
  };

  if (captionsKey) {
    metadata.captions_key = captionsKey;
    metadata.captions_language = language.toLowerCase();
    metadata.captions_label = label;
  }

  const { error: metadataError } = await supabase
    .from("lesson_videos")
    .upsert(metadata, { onConflict: "lesson_slug" });

  if (metadataError) {
    throw new Error(
      `Media was uploaded to R2, but Supabase metadata could not be saved: ${metadataError.message}`,
    );
  }

  return {
    bucket: env.bucket,
    bytes: fileStats.size,
    captionsBytes: captionsStats?.size,
    captionsKey,
    key,
    metadataSaved: true,
  };
}

async function main() {
  loadEnvConfig(process.cwd());
  const options = parseUploadArguments(process.argv.slice(2));

  console.log(`Uploading ${path.resolve(options.videoPath)}...`);
  const result = await uploadLessonVideo(options);
  console.log(
    `Uploaded ${(result.bytes / 1024 / 1024).toFixed(2)} MiB to r2://${result.bucket}/${result.key}`,
  );
  if (result.captionsKey) {
    console.log(
      `Uploaded captions to r2://${result.bucket}/${result.captionsKey}`,
    );
  }
  console.log(`Saved video metadata for ${options.lessonSlug} in Supabase.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Video upload failed.");
    process.exitCode = 1;
  });
}
