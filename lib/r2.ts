import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const SIGNED_MEDIA_URL_TTL_SECONDS = 15 * 60;

type R2Env = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export class R2ConfigurationError extends Error {
  constructor() {
    super("Cloudflare R2 is not configured.");
    this.name = "R2ConfigurationError";
  }
}

function getR2Env(): R2Env {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new R2ConfigurationError();
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function getLessonVideoKey(slug: string) {
  return `lessons/${slug}.mp4`;
}

async function createSignedMediaUrl(key: string, contentType: string) {
  const env = getR2Env();
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: env.bucket,
      Key: key,
      ResponseContentDisposition: "inline",
      ResponseContentType: contentType,
    }),
    { expiresIn: SIGNED_MEDIA_URL_TTL_SECONDS },
  );
}

export function createLessonVideoUrl(key: string) {
  return createSignedMediaUrl(key, "video/mp4");
}

export function createLessonCaptionsUrl(key: string) {
  return createSignedMediaUrl(key, "text/vtt; charset=utf-8");
}
