import path from 'path';
import { config } from '../config';

/**
 * Validate bucket name according to DNS-safe naming rules
 * - Lowercase alphanumeric + hyphens
 * - 3-63 characters
 * - Cannot start or end with hyphen
 */
export function validateBucketName(name: string): boolean {
  const bucketRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
  return bucketRegex.test(name);
}

/**
 * Sanitize object key to prevent path traversal attacks
 */
export function sanitizeKey(key: string): string {
  // Remove leading slashes
  let sanitized = key.replace(/^\/+/, '');
  
  // Normalize path (remove .., ., etc)
  sanitized = path.normalize(sanitized);
  
  // Remove any remaining path traversal attempts
  sanitized = sanitized.replace(/\.\./g, '');
  
  return sanitized;
}

/**
 * Get the full filesystem path for an object
 */
export function getObjectPath(bucket: string, key: string): string {
  const sanitizedKey = sanitizeKey(key);
  return path.join(config.dataDir, bucket, sanitizedKey);
}

/**
 * Get the bucket directory path
 */
export function getBucketPath(bucket: string): string {
  return path.join(config.dataDir, bucket);
}

/**
 * Get the multipart temp directory path
 */
export function getMultipartTempPath(uploadId: string): string {
  return path.join(config.dataDir, '.multipart-tmp', uploadId);
}

/**
 * Get the path for a specific multipart part
 */
export function getPartPath(uploadId: string, partNumber: number): string {
  return path.join(getMultipartTempPath(uploadId), `part-${partNumber}`);
}
