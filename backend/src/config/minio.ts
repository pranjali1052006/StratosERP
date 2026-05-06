import { Client } from 'minio';
import dotenv from 'dotenv';

dotenv.config();

let minioAvailable = false;

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || '',
  secretKey: process.env.MINIO_SECRET_KEY || '',
});

export const BUCKETS = {
  STUDY_MATERIALS: process.env.MINIO_BUCKET_STUDY_MATERIALS || 'study-materials',
  NOTICES: process.env.MINIO_BUCKET_NOTICES || 'notices',
  SUBMISSIONS: process.env.MINIO_BUCKET_SUBMISSIONS || 'submissions',
};

export function isMinioAvailable(): boolean {
  return minioAvailable;
}

export async function ensureBucketsExist(): Promise<boolean> {
  if (!process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY) {
    minioAvailable = false;
    console.warn('[MinIO] MINIO_ACCESS_KEY or MINIO_SECRET_KEY missing. MinIO-dependent features are disabled.');
    return false;
  }

  try {
    for (const bucket of Object.values(BUCKETS)) {
      const exists = await minioClient.bucketExists(bucket);
      if (!exists) {
        await minioClient.makeBucket(bucket, 'us-east-1');
        console.log(`[MinIO] Created bucket: ${bucket}`);
      } else {
        console.log(`[MinIO] Bucket exists: ${bucket}`);
      }
    }
    minioAvailable = true;
    return true;
  } catch (error) {
    minioAvailable = false;
    const reason = error instanceof Error ? error.message : 'Unknown MinIO error';
    console.warn(`[MinIO] Initialization failed: ${reason}. Continuing without MinIO support.`);
    return false;
  }
}

export default minioClient;
