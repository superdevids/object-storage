import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  getObjectPath,
  getBucketPath,
  getMultipartTempPath,
  getPartPath,
} from '../utils/path.util';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export class StorageService {
  /**
   * Ensure data directory exists
   */
  async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(config.dataDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory', { error });
      throw error;
    }
  }

  /**
   * Ensure bucket directory exists
   */
  async ensureBucketDir(bucket: string): Promise<void> {
    const bucketPath = getBucketPath(bucket);
    try {
      await fs.mkdir(bucketPath, { recursive: true });
      logger.debug('Bucket directory ensured', { bucket, path: bucketPath });
    } catch (error) {
      logger.error('Failed to create bucket directory', { bucket, error });
      throw error;
    }
  }

  /**
   * Write object to filesystem
   */
  async writeObject(bucket: string, key: string, data: Buffer): Promise<void> {
    const objectPath = getObjectPath(bucket, key);
    const objectDir = path.dirname(objectPath);

    try {
      // Ensure parent directories exist
      await fs.mkdir(objectDir, { recursive: true });

      // Write file
      await fs.writeFile(objectPath, data);
      logger.info('Object written', { bucket, key, size: data.length });
    } catch (error) {
      logger.error('Failed to write object', { bucket, key, error });
      throw error;
    }
  }

  /**
   * Read object from filesystem
   */
  async readObject(bucket: string, key: string): Promise<Buffer> {
    const objectPath = getObjectPath(bucket, key);

    try {
      const data = await fs.readFile(objectPath);
      logger.debug('Object read', { bucket, key, size: data.length });
      return data;
    } catch (error) {
      logger.error('Failed to read object', { bucket, key, error });
      throw error;
    }
  }

  /**
   * Check if object exists
   */
  async objectExists(bucket: string, key: string): Promise<boolean> {
    const objectPath = getObjectPath(bucket, key);
    try {
      await fs.access(objectPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete object from filesystem
   */
  async deleteObject(bucket: string, key: string): Promise<void> {
    const objectPath = getObjectPath(bucket, key);

    try {
      await fs.unlink(objectPath);
      logger.info('Object deleted', { bucket, key });
    } catch (error) {
      logger.error('Failed to delete object', { bucket, key, error });
      throw error;
    }
  }

  /**
   * Delete bucket directory
   */
  async deleteBucketDir(bucket: string): Promise<void> {
    const bucketPath = getBucketPath(bucket);

    try {
      await fs.rm(bucketPath, { recursive: true, force: true });
      logger.info('Bucket directory deleted', { bucket });
    } catch (error) {
      logger.error('Failed to delete bucket directory', { bucket, error });
      throw error;
    }
  }

  /**
   * Write multipart part to temp storage
   */
  async writePartTemp(uploadId: string, partNumber: number, data: Buffer): Promise<void> {
    const partPath = getPartPath(uploadId, partNumber);
    const partDir = path.dirname(partPath);

    try {
      await fs.mkdir(partDir, { recursive: true });
      await fs.writeFile(partPath, data);
      logger.info('Part written to temp', { uploadId, partNumber, size: data.length });
    } catch (error) {
      logger.error('Failed to write part', { uploadId, partNumber, error });
      throw error;
    }
  }

  /**
   * Read multipart part from temp storage
   */
  async readPartTemp(uploadId: string, partNumber: number): Promise<Buffer> {
    const partPath = getPartPath(uploadId, partNumber);

    try {
      const data = await fs.readFile(partPath);
      return data;
    } catch (error) {
      logger.error('Failed to read part', { uploadId, partNumber, error });
      throw error;
    }
  }

  /**
   * Merge multipart parts into final object
   */
  async mergeParts(
    uploadId: string,
    targetBucket: string,
    targetKey: string,
    partNumbers: number[]
  ): Promise<void> {
    const finalPath = getObjectPath(targetBucket, targetKey);
    const finalDir = path.dirname(finalPath);
    const tempFinalPath = `${finalPath}.tmp`;

    try {
      // Ensure target directory exists
      await fs.mkdir(finalDir, { recursive: true });

      // Create write stream for final file
      const writeStream = createWriteStream(tempFinalPath);

      // Merge parts sequentially
      for (const partNumber of partNumbers.sort((a, b) => a - b)) {
        const partPath = getPartPath(uploadId, partNumber);
        const readStream = createReadStream(partPath);
        
        await new Promise<void>((resolve, reject) => {
          readStream.on('data', (chunk) => writeStream.write(chunk));
          readStream.on('end', resolve);
          readStream.on('error', reject);
        });
      }

      // Close write stream
      await new Promise<void>((resolve, reject) => {
        writeStream.end(() => resolve());
        writeStream.on('error', reject);
      });

      // Atomic rename
      await fs.rename(tempFinalPath, finalPath);

      logger.info('Parts merged successfully', {
        uploadId,
        targetBucket,
        targetKey,
        partCount: partNumbers.length,
      });
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempFinalPath);
      } catch {}

      logger.error('Failed to merge parts', { uploadId, error });
      throw error;
    }
  }

  /**
   * Clean up multipart temp directory
   */
  async cleanupMultipartTemp(uploadId: string): Promise<void> {
    const tempPath = getMultipartTempPath(uploadId);

    try {
      await fs.rm(tempPath, { recursive: true, force: true });
      logger.info('Multipart temp cleaned up', { uploadId });
    } catch (error) {
      logger.error('Failed to cleanup multipart temp', { uploadId, error });
      throw error;
    }
  }

  /**
   * Get object size
   */
  async getObjectSize(bucket: string, key: string): Promise<number> {
    const objectPath = getObjectPath(bucket, key);
    try {
      const stats = await fs.stat(objectPath);
      return stats.size;
    } catch (error) {
      logger.error('Failed to get object size', { bucket, key, error });
      throw error;
    }
  }
}

export const storageService = new StorageService();
