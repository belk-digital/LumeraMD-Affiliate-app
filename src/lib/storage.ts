import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Neon Object Storage — S3-compatible, branch-scoped (the `testing` Neon branch has its own
// bucket/credentials, separate from `production`, via .env.local overriding these same var names).
const client = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.NEON_STORAGE_BUCKET!;

export async function uploadFile(key: string, body: Buffer, contentType: string) {
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function downloadFile(key: string): Promise<{ body: Buffer; contentType?: string } | null> {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) return null;
    return { body: Buffer.from(bytes), contentType: res.ContentType };
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : undefined;
    const status =
      typeof err === "object" && err !== null && "$metadata" in err
        ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined;
    if (name === "NoSuchKey" || status === 404) return null;
    throw err;
  }
}

export async function deleteFile(key: string) {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
