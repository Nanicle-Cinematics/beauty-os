import "server-only";

import { randomBytes } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type UploadInput = {
  dataUrl: string;
  keyPrefix: string;
};

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

let client: S3Client | null = null;

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/\/$/, "") ?? "";
}

function r2Config(): R2Config | null {
  const config = {
    accountId: cleanEnv(process.env.R2_ACCOUNT_ID),
    accessKeyId: cleanEnv(process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: cleanEnv(process.env.R2_SECRET_ACCESS_KEY),
    bucket: cleanEnv(process.env.R2_BUCKET),
    publicBaseUrl: cleanEnv(process.env.R2_PUBLIC_BASE_URL),
  };

  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucket || !config.publicBaseUrl) {
    return null;
  }

  return config;
}

export function isR2StorageConfigured() {
  return r2Config() != null;
}

function extensionFor(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1].toLowerCase();
  if (!contentType.startsWith("image/")) return null;
  return { contentType, body: Buffer.from(match[2], "base64") };
}

function storageClient(config: R2Config) {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return client;
}

export async function uploadGalleryDataUrlToR2(input: UploadInput) {
  const config = r2Config();
  if (!config) return null;

  const parsed = parseDataUrl(input.dataUrl);
  if (!parsed) throw new Error("Only pasted or uploaded image files can be stored in R2.");

  const key = `${input.keyPrefix.replace(/^\/+|\/+$/g, "")}/${Date.now()}-${randomBytes(10).toString("hex")}.${extensionFor(parsed.contentType)}`;

  await storageClient(config).send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: parsed.body,
    ContentType: parsed.contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));

  return {
    key,
    url: `${config.publicBaseUrl}/${key}`,
  };
}
