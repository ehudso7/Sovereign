import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

export interface StoredObject {
  content: Buffer;
  contentType: string;
  contentLength: number;
}

export class ObjectStorageService {
  private readonly client: S3Client;

  constructor(
    private readonly config: {
      bucket: string;
      region: string;
      endpoint?: string;
      accessKeyId: string;
      secretAccessKey: string;
    },
  ) {
    const forcePathStyle = config.endpoint
      ? /(localhost|127\.0\.0\.1|minio)/i.test(config.endpoint)
      : false;

    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): ObjectStorageService | null {
    const bucket = env.R2_BUCKET?.trim();
    const region = env.R2_REGION?.trim() || "auto";
    const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();

    if (!bucket || !accessKeyId || !secretAccessKey) {
      return null;
    }

    return new ObjectStorageService({
      bucket,
      region,
      endpoint: env.R2_ENDPOINT?.trim() || undefined,
      accessKeyId,
      secretAccessKey,
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    } catch (error) {
      if (!(error instanceof S3ServiceException) || error.$metadata.httpStatusCode !== 404) {
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
          return;
        } catch (createError) {
          if (createError instanceof S3ServiceException && createError.name === "BucketAlreadyOwnedByYou") {
            return;
          }
          throw createError;
        }
      }

      await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<{ key: string; sizeBytes: number }> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    return { key, sizeBytes: body.byteLength };
  }

  async getObject(key: string): Promise<StoredObject> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );

    const content = await streamToBuffer(result.Body);
    return {
      content,
      contentType: result.ContentType ?? "application/octet-stream",
      contentLength: content.byteLength,
    };
  }
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "string") return Buffer.from(body);

  if (body instanceof Readable || isAsyncIterable(body)) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error("Unsupported S3 response body type.");
}

function isAsyncIterable(value: unknown): value is AsyncIterable<Uint8Array | Buffer | string> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}
