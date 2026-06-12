/**
 * S3-compatible artifact storage (AWS S3, MinIO, Cloudflare R2, ...).
 *
 * Enable with:
 *   ARTIFACT_STORAGE=s3
 *   ARTIFACT_S3_BUCKET=your-bucket
 *   ARTIFACT_S3_REGION=us-east-1
 *   ARTIFACT_S3_ACCESS_KEY_ID=...
 *   ARTIFACT_S3_SECRET_ACCESS_KEY=...
 * Optional:
 *   ARTIFACT_S3_ENDPOINT=https://minio.example.com
 *   ARTIFACT_S3_FORCE_PATH_STYLE=true
 *
 * Requires: npm install @aws-sdk/client-s3
 */

const {
  buildRunFailureScreenshotKey,
  buildDryRunFailureScreenshotKey,
  normalizeStoredArtifactKey,
  contentTypeFromKey,
} = require('../artifactKeys');

const loadS3Client = () => {
  try {
    return require('@aws-sdk/client-s3');
  } catch {
    throw new Error(
      'ARTIFACT_STORAGE=s3 requires @aws-sdk/client-s3. Run: npm install @aws-sdk/client-s3',
    );
  }
};

const createS3ArtifactStorage = ({
  bucket,
  region,
  accessKeyId,
  secretAccessKey,
  endpoint,
  forcePathStyle = false,
} = {}) => {
  const resolvedBucket = String(bucket || process.env.ARTIFACT_S3_BUCKET || '').trim();
  const resolvedRegion = String(region || process.env.ARTIFACT_S3_REGION || 'us-east-1').trim();
  const resolvedAccessKeyId = String(accessKeyId || process.env.ARTIFACT_S3_ACCESS_KEY_ID || '').trim();
  const resolvedSecretAccessKey = String(
    secretAccessKey || process.env.ARTIFACT_S3_SECRET_ACCESS_KEY || '',
  ).trim();
  const resolvedEndpoint = String(endpoint || process.env.ARTIFACT_S3_ENDPOINT || '').trim();
  const resolvedForcePathStyle = forcePathStyle
    || String(process.env.ARTIFACT_S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true';

  const missing = [];
  if (!resolvedBucket) missing.push('ARTIFACT_S3_BUCKET');
  if (!resolvedAccessKeyId) missing.push('ARTIFACT_S3_ACCESS_KEY_ID');
  if (!resolvedSecretAccessKey) missing.push('ARTIFACT_S3_SECRET_ACCESS_KEY');
  if (missing.length > 0) {
    throw new Error(`S3 artifact storage requires: ${missing.join(', ')}`);
  }

  const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = loadS3Client();
  const client = new S3Client({
    region: resolvedRegion,
    credentials: {
      accessKeyId: resolvedAccessKeyId,
      secretAccessKey: resolvedSecretAccessKey,
    },
    ...(resolvedEndpoint
      ? {
        endpoint: resolvedEndpoint,
        forcePathStyle: resolvedForcePathStyle,
      }
      : {}),
  });

  return {
    driver: 's3',
    bucket: resolvedBucket,

    buildRunFailureScreenshotKey,
    buildDryRunFailureScreenshotKey,
    normalizeStoredKey: normalizeStoredArtifactKey,

    async saveBuffer(key, buffer, contentType) {
      const normalizedKey = normalizeStoredArtifactKey(key);
      await client.send(new PutObjectCommand({
        Bucket: resolvedBucket,
        Key: normalizedKey,
        Body: buffer,
        ContentType: contentType || contentTypeFromKey(normalizedKey),
      }));
      return normalizedKey;
    },

    async exists(storedOrKey) {
      const normalizedKey = normalizeStoredArtifactKey(storedOrKey);
      try {
        await client.send(new HeadObjectCommand({
          Bucket: resolvedBucket,
          Key: normalizedKey,
        }));
        return true;
      } catch {
        return false;
      }
    },

    async getReadablePayload(storedOrKey) {
      const normalizedKey = normalizeStoredArtifactKey(storedOrKey);
      const response = await client.send(new GetObjectCommand({
        Bucket: resolvedBucket,
        Key: normalizedKey,
      }));
      return {
        stream: response.Body,
        contentType: response.ContentType || contentTypeFromKey(normalizedKey),
      };
    },

    getContentType(storedOrKey) {
      return contentTypeFromKey(normalizeStoredArtifactKey(storedOrKey) || storedOrKey);
    },
  };
};

module.exports = {
  createS3ArtifactStorage,
};
