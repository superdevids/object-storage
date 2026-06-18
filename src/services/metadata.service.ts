import { database } from '../db/client';
import { logger } from '../utils/logger';
import { Bucket, BucketInfo } from '../types/bucket.types';
import { ObjectMetadata, CreateObjectDto } from '../types/object.types';
import { MultipartUpload, MultipartPart } from '../types/multipart.types';
import { AppError, ErrorCode } from '../types/error.types';
import { randomUUID } from 'crypto';

export class MetadataService {
  // ==================== BUCKET OPERATIONS ====================

  /**
   * Create a new bucket
   */
  async createBucket(name: string): Promise<Bucket> {
    const now = new Date().toISOString();

    try {
      await database.run(
        'INSERT INTO buckets (name, created_at, updated_at) VALUES (?, ?, ?)',
        [name, now, now]
      );

      const bucket = await database.get<any>(
        'SELECT * FROM buckets WHERE name = ?',
        [name]
      );

      if (!bucket) {
        throw new Error('Failed to retrieve created bucket');
      }

      logger.info('Bucket created', { bucket: name });
      return {
        id: bucket.id,
        name: bucket.name,
        createdAt: bucket.created_at,
        updatedAt: bucket.updated_at,
      };
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new AppError(
          ErrorCode.BUCKET_ALREADY_EXISTS,
          `Bucket '${name}' already exists`,
          409
        );
      }
      logger.error('Failed to create bucket', { bucket: name, error });
      throw error;
    }
  }

  /**
   * List all buckets
   */
  async listBuckets(): Promise<Bucket[]> {
    try {
      const buckets = await database.all<any>(
        'SELECT * FROM buckets ORDER BY created_at DESC'
      );
      return buckets.map((b: any) => ({
        id: b.id,
        name: b.name,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to list buckets', { error });
      throw error;
    }
  }

  /**
   * Get bucket by name
   */
  async getBucket(name: string): Promise<Bucket | null> {
    try {
      const bucket = await database.get<any>(
        'SELECT * FROM buckets WHERE name = ?',
        [name]
      );
      if (!bucket) {
        return null;
      }
      return {
        id: bucket.id,
        name: bucket.name,
        createdAt: bucket.created_at,
        updatedAt: bucket.updated_at,
      };
    } catch (error) {
      logger.error('Failed to get bucket', { bucket: name, error });
      throw error;
    }
  }

  /**
   * Get bucket info (with object count and total size)
   */
  async getBucketInfo(name: string): Promise<BucketInfo> {
    try {
      const bucket = await this.getBucket(name);
      if (!bucket) {
        throw new AppError(
          ErrorCode.BUCKET_NOT_FOUND,
          `Bucket '${name}' does not exist`,
          404
        );
      }

      const objectCount = await this.getObjectCount(name);
      const totalSize = await this.getTotalSize(name);

      return {
        name: bucket.name,
        objectCount,
        totalSize,
        createdAt: bucket.createdAt,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get bucket info', { bucket: name, error });
      throw error;
    }
  }

  /**
   * Delete bucket
   */
  async deleteBucket(name: string): Promise<void> {
    try {
      await database.run('DELETE FROM buckets WHERE name = ?', [name]);
      logger.info('Bucket deleted', { bucket: name });
    } catch (error) {
      logger.error('Failed to delete bucket', { bucket: name, error });
      throw error;
    }
  }

  /**
   * Check if bucket is empty
   */
  async isBucketEmpty(name: string): Promise<boolean> {
    try {
      const count = await this.getObjectCount(name);
      return count === 0;
    } catch (error) {
      logger.error('Failed to check if bucket is empty', { bucket: name, error });
      throw error;
    }
  }

  /**
   * Get object count for bucket
   */
  async getObjectCount(bucket: string): Promise<number> {
    try {
      const result = await database.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM objects WHERE bucket_name = ?',
        [bucket]
      );
      return result?.count || 0;
    } catch (error) {
      logger.error('Failed to get object count', { bucket, error });
      throw error;
    }
  }

  /**
   * Get total size of all objects in bucket
   */
  async getTotalSize(bucket: string): Promise<number> {
    try {
      const result = await database.get<{ total: number }>(
        'SELECT COALESCE(SUM(size), 0) as total FROM objects WHERE bucket_name = ?',
        [bucket]
      );
      return result?.total || 0;
    } catch (error) {
      logger.error('Failed to get total size', { bucket, error });
      throw error;
    }
  }

  // ==================== OBJECT OPERATIONS ====================

  /**
   * Create or update object metadata
   */
  async createObject(data: CreateObjectDto): Promise<ObjectMetadata> {
    const now = new Date().toISOString();
    const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;

    try {
      // Try to insert, if exists then update
      await database.run(
        `INSERT INTO objects (bucket_name, key, size, content_type, etag, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(bucket_name, key) DO UPDATE SET
           size = excluded.size,
           content_type = excluded.content_type,
           etag = excluded.etag,
           updated_at = excluded.updated_at,
           metadata = excluded.metadata`,
        [
          data.bucketName,
          data.key,
          data.size,
          data.contentType,
          data.etag,
          now,
          now,
          metadataJson,
        ]
      );

      const object = await this.getObject(data.bucketName, data.key);
      if (!object) {
        throw new Error('Failed to retrieve created object');
      }

      logger.info('Object metadata created', {
        bucket: data.bucketName,
        key: data.key,
        size: data.size,
      });

      return object;
    } catch (error) {
      logger.error('Failed to create object metadata', {
        bucket: data.bucketName,
        key: data.key,
        error,
      });
      throw error;
    }
  }

  /**
   * Get object metadata
   */
  async getObject(bucket: string, key: string): Promise<ObjectMetadata | null> {
    try {
      const object = await database.get<any>(
        'SELECT * FROM objects WHERE bucket_name = ? AND key = ?',
        [bucket, key]
      );

      if (!object) {
        return null;
      }

      // Parse metadata JSON
      const metadata = object.metadata ? JSON.parse(object.metadata) : undefined;

      return {
        id: object.id,
        bucketName: object.bucket_name,
        key: object.key,
        size: object.size,
        contentType: object.content_type,
        etag: object.etag,
        createdAt: object.created_at,
        updatedAt: object.updated_at,
        metadata,
      };
    } catch (error) {
      logger.error('Failed to get object metadata', { bucket, key, error });
      throw error;
    }
  }

  /**
   * List objects with optional prefix filter
   */
  async listObjects(
    bucket: string,
    prefix: string = '',
    limit: number = 100,
    cursor?: string
  ): Promise<ObjectMetadata[]> {
    try {
      let sql = 'SELECT * FROM objects WHERE bucket_name = ?';
      const params: any[] = [bucket];

      // Add prefix filter
      if (prefix) {
        sql += ' AND key LIKE ?';
        params.push(`${prefix}%`);
      }

      // Add cursor for pagination
      if (cursor) {
        sql += ' AND key > ?';
        params.push(cursor);
      }

      sql += ' ORDER BY key ASC LIMIT ?';
      params.push(limit);

      const objects = await database.all<any>(sql, params);

      return objects.map(obj => ({
        id: obj.id,
        bucketName: obj.bucket_name,
        key: obj.key,
        size: obj.size,
        contentType: obj.content_type,
        etag: obj.etag,
        createdAt: obj.created_at,
        updatedAt: obj.updated_at,
        metadata: obj.metadata ? JSON.parse(obj.metadata) : undefined,
      }));
    } catch (error) {
      logger.error('Failed to list objects', { bucket, prefix, error });
      throw error;
    }
  }

  /**
   * Delete object metadata
   */
  async deleteObject(bucket: string, key: string): Promise<void> {
    try {
      await database.run(
        'DELETE FROM objects WHERE bucket_name = ? AND key = ?',
        [bucket, key]
      );
      logger.info('Object metadata deleted', { bucket, key });
    } catch (error) {
      logger.error('Failed to delete object metadata', { bucket, key, error });
      throw error;
    }
  }

  // ==================== MULTIPART OPERATIONS ====================

  /**
   * Create multipart upload
   */
  async createMultipartUpload(bucket: string, key: string): Promise<MultipartUpload> {
    const uploadId = randomUUID();
    const now = new Date().toISOString();

    try {
      await database.run(
        'INSERT INTO multipart_uploads (upload_id, bucket_name, key, created_at) VALUES (?, ?, ?, ?)',
        [uploadId, bucket, key, now]
      );

      const upload = await database.get<any>(
        'SELECT * FROM multipart_uploads WHERE upload_id = ?',
        [uploadId]
      );

      if (!upload) {
        throw new Error('Failed to retrieve created multipart upload');
      }

      logger.info('Multipart upload created', { uploadId, bucket, key });

      return {
        id: upload.id,
        uploadId: upload.upload_id,
        bucketName: upload.bucket_name,
        key: upload.key,
        createdAt: upload.created_at,
      };
    } catch (error) {
      logger.error('Failed to create multipart upload', { bucket, key, error });
      throw error;
    }
  }

  /**
   * Get multipart upload
   */
  async getMultipartUpload(uploadId: string): Promise<MultipartUpload | null> {
    try {
      const upload = await database.get<any>(
        'SELECT * FROM multipart_uploads WHERE upload_id = ?',
        [uploadId]
      );

      if (!upload) {
        return null;
      }

      return {
        id: upload.id,
        uploadId: upload.upload_id,
        bucketName: upload.bucket_name,
        key: upload.key,
        createdAt: upload.created_at,
      };
    } catch (error) {
      logger.error('Failed to get multipart upload', { uploadId, error });
      throw error;
    }
  }

  /**
   * Create part
   */
  async createPart(
    uploadId: string,
    partNumber: number,
    size: number,
    etag: string
  ): Promise<MultipartPart> {
    const now = new Date().toISOString();

    try {
      await database.run(
        `INSERT INTO multipart_parts (upload_id, part_number, size, etag, uploaded_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(upload_id, part_number) DO UPDATE SET
           size = excluded.size,
           etag = excluded.etag,
           uploaded_at = excluded.uploaded_at`,
        [uploadId, partNumber, size, etag, now]
      );

      const part = await database.get<any>(
        'SELECT * FROM multipart_parts WHERE upload_id = ? AND part_number = ?',
        [uploadId, partNumber]
      );

      if (!part) {
        throw new Error('Failed to retrieve created part');
      }

      logger.info('Part created', { uploadId, partNumber, size });

      return {
        id: part.id,
        uploadId: part.upload_id,
        partNumber: part.part_number,
        size: part.size,
        etag: part.etag,
        uploadedAt: part.uploaded_at,
      };
    } catch (error) {
      logger.error('Failed to create part', { uploadId, partNumber, error });
      throw error;
    }
  }

  /**
   * List parts for multipart upload
   */
  async listParts(uploadId: string): Promise<MultipartPart[]> {
    try {
      const parts = await database.all<any>(
        'SELECT * FROM multipart_parts WHERE upload_id = ? ORDER BY part_number ASC',
        [uploadId]
      );

      return parts.map(part => ({
        id: part.id,
        uploadId: part.upload_id,
        partNumber: part.part_number,
        size: part.size,
        etag: part.etag,
        uploadedAt: part.uploaded_at,
      }));
    } catch (error) {
      logger.error('Failed to list parts', { uploadId, error });
      throw error;
    }
  }

  /**
   * Delete multipart upload and all its parts
   */
  async deleteMultipartUpload(uploadId: string): Promise<void> {
    try {
      // Parts will be deleted automatically due to CASCADE
      await database.run('DELETE FROM multipart_uploads WHERE upload_id = ?', [uploadId]);
      logger.info('Multipart upload deleted', { uploadId });
    } catch (error) {
      logger.error('Failed to delete multipart upload', { uploadId, error });
      throw error;
    }
  }
}

export const metadataService = new MetadataService();
