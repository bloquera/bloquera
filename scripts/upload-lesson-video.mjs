import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

const MAX_SINGLE_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const LESSON_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getLessonVideoKey(slug) {
  if (!LESSON_SLUG_PATTERN.test(slug)) {
    throw new Error(
      "Lesson slug must contain lowercase letters, numbers, and single hyphens only.",
    );
  }

  return `lessons/${slug}.mp4`;
}

export function parseUploadArguments(args) {
  const force = args.includes("--force");
  const positional = args.filter((argument) => argument !== "--force");

  if (positional.length !== 2) {
    throw new Error(
      "Usage: npm run video:upload -- <lesson-slug> <video.mp4> [--force]",
    );
  }

  return {
    slug: positional[0],
    videoPath: positional[1],
    force,
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

function isMissingObject(error) {
  return (
    error?.$metadata?.httpStatusCode === 404 ||
    error?.name === "NotFound" ||
    error?.name === "NoSuchKey"
  );
}

export async function uploadLessonVideo({ slug, videoPath, force = false }) {
  const key = getLessonVideoKey(slug);
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
    try {
      await client.send(new HeadObjectCommand({ Bucket: env.bucket, Key: key }));
      throw new Error(
        `An R2 object already exists at ${key}. Pass --force to replace it.`,
      );
    } catch (error) {
      if (!isMissingObject(error)) {
        throw error;
      }
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
        "lesson-slug": slug,
      },
    }),
  );

  const supabase = createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { error: metadataError } = await supabase.from("lesson_videos").upsert(
    {
      lesson_slug: slug,
      video_key: key,
      is_available: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lesson_slug" },
  );

  if (metadataError) {
    throw new Error(
      `The video was uploaded to ${key}, but Supabase metadata could not be saved: ${metadataError.message}`,
    );
  }

  return {
    bucket: env.bucket,
    bytes: fileStats.size,
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
  console.log(`Saved video metadata for ${options.slug} in Supabase.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Video upload failed.");
    process.exitCode = 1;
  });
}
