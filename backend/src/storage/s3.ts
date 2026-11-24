import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';

export type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicUrl: string;
};

export function s3ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): S3Config {
  const bucket = env.S3_BUCKET ?? 'rapp-fotos';
  const endpoint = (env.S3_ENDPOINT ?? 'http://127.0.0.1:9000').replace(/\/$/, '');
  return {
    endpoint,
    region: env.S3_REGION ?? 'us-east-1',
    bucket,
    accessKey: env.S3_ACCESS_KEY ?? 'rapp',
    secretKey: env.S3_SECRET_KEY ?? 'rapp-secret',
    publicUrl: (env.S3_PUBLIC_URL ?? `${endpoint}/${bucket}`).replace(/\/$/, ''),
  };
}

export function createS3Client(config: S3Config) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export function objectUrl(config: S3Config, key: string) {
  return `${config.publicUrl}/${key}`;
}

export function keyFromStoredUrl(config: S3Config, url: string) {
  const prefix = `${config.publicUrl}/`;
  if (url.startsWith(prefix)) return decodeURIComponent(url.slice(prefix.length));
  const marker = `/${config.bucket}/`;
  const index = url.indexOf(marker);
  if (url.startsWith('http') && index >= 0) return decodeURIComponent(url.slice(index + marker.length));
  if (url.startsWith('/uploads/')) return url.slice('/uploads/'.length);
  return null;
}

export async function ensurePublicBucket(client: S3Client, config: S3Config) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch (error) {
    if (!isMissingBucket(error)) throw error;
    await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
  }

  await client.send(
    new PutBucketPolicyCommand({
      Bucket: config.bucket,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${config.bucket}/*`],
          },
        ],
      }),
    }),
  );
}

export async function putFoto(client: S3Client, config: S3Config, key: string, body: Buffer) {
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: 'image/webp',
    }),
  );
  return objectUrl(config, key);
}

export async function deleteFoto(client: S3Client, config: S3Config, url: string) {
  const key = keyFromStoredUrl(config, url);
  if (!key) return;
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

export async function deletePrefix(client: S3Client, config: S3Config, prefix: string) {
  let token: string | undefined;
  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    const keys = (listed.Contents ?? []).flatMap((item) => (item.Key ? [item.Key] : []));
    if (keys.length) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: config.bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);
}

function isMissingBucket(error: unknown) {
  const err = error as S3ServiceException;
  return err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404;
}
