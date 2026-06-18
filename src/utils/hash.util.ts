import crypto from 'crypto';

/**
 * Generate ETag (MD5 hash) for object content
 */
export function generateETag(data: Buffer): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Generate SHA256 hash for object content
 */
export function generateSHA256(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
