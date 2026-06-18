import { storageService } from './storage.service';
import { metadataService } from './metadata.service';
import { logger } from '../utils/logger';
import { generateETag } from '../utils/hash.util';
import { AppError, ErrorCode } from '../types/error.types';
import { ObjectMetadata } from '../types/object.types';

export class MultipartService {
  /**
   * Initiate multipart upload
   */
  async initiate(bucket: string, key: string): Promise<{ uploadId: string }> {
    try {
      // Check if bucket exists
      const bucketExists = await metadataService.getBucket(bucket);
      if (!bucketExists) {
        throw new AppError(
          ErrorCode.BUCKET_NOT_FOUND,
          `Bucket '${bucket}' does not exist`,
          404
        );
      }

      const upload = await metadataService.createMultipartUpload(bucket, key);
      logger.info('Multipart upload initiated', {
        uploadId: upload.uploadId,
        bucket,
        key,
      });

      return { uploadId: upload.uploadId };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to initiate multipart upload', { bucket, key, error });
      throw error;
    }
  }

  /**
   * Upload a part
   */
  async uploadPart(
    uploadId: string,
    partNumber: number,
    data: Buffer
  ): Promise<{ etag: string; size: number }> {
    try {
      // Verify upload exists
      const upload = await metadataService.getMultipartUpload(uploadId);
      if (!upload) {
        throw new AppError(
          ErrorCode.UPLOAD_NOT_FOUND,
          `Upload '${uploadId}' does not exist`,
          404
        );
      }

      // Generate ETag for the part
      const etag = generateETag(data);

      // Write part to temp storage
      await storageService.writePartTemp(uploadId, partNumber, data);

      // Save part metadata
      await metadataService.createPart(uploadId, partNumber, data.length, etag);

      logger.info('Part uploaded', {
        uploadId,
        partNumber,
        size: data.length,
        etag,
      });

      return { etag, size: data.length };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to upload part', { uploadId, partNumber, error });
      throw error;
    }
  }

  /**
   * Complete multipart upload
   */
  async complete(uploadId: string, parts: number[]): Promise<ObjectMetadata> {
    try {
      // Verify upload exists
      const upload = await metadataService.getMultipartUpload(uploadId);
      if (!upload) {
        throw new AppError(
          ErrorCode.UPLOAD_NOT_FOUND,
          `Upload '${uploadId}' does not exist`,
          404
        );
      }

      // Get all uploaded parts
      const uploadedParts = await metadataService.listParts(uploadId);
      const uploadedPartNumbers = uploadedParts.map(p => p.partNumber);

      // Validate all parts are uploaded
      for (const partNumber of parts) {
        if (!uploadedPartNumbers.includes(partNumber)) {
          throw new AppError(
            ErrorCode.INVALID_REQUEST,
            `Part ${partNumber} has not been uploaded`,
            400
          );
        }
      }

      // Merge parts into final object
      await storageService.mergeParts(
        uploadId,
        upload.bucketName,
        upload.key,
        parts
      );

      // Calculate final size and ETag
      const totalSize = uploadedParts
        .filter(p => parts.includes(p.partNumber))
        .reduce((sum, p) => sum + p.size, 0);

      // Read final object to calculate ETag
      const finalData = await storageService.readObject(upload.bucketName, upload.key);
      const finalETag = generateETag(finalData);

      // Determine content type (default to application/octet-stream)
      const contentType = this.guessContentType(upload.key);

      // Create object metadata
      const objectMetadata = await metadataService.createObject({
        bucketName: upload.bucketName,
        key: upload.key,
        size: totalSize,
        contentType,
        etag: finalETag,
      });

      // Cleanup temp files and multipart metadata
      await storageService.cleanupMultipartTemp(uploadId);
      await metadataService.deleteMultipartUpload(uploadId);

      logger.info('Multipart upload completed', {
        uploadId,
        bucket: upload.bucketName,
        key: upload.key,
        size: totalSize,
        partCount: parts.length,
      });

      return objectMetadata;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to complete multipart upload', { uploadId, error });
      throw error;
    }
  }

  /**
   * Abort multipart upload
   */
  async abort(uploadId: string): Promise<void> {
    try {
      // Verify upload exists
      const upload = await metadataService.getMultipartUpload(uploadId);
      if (!upload) {
        throw new AppError(
          ErrorCode.UPLOAD_NOT_FOUND,
          `Upload '${uploadId}' does not exist`,
          404
        );
      }

      // Cleanup temp files
      await storageService.cleanupMultipartTemp(uploadId);

      // Delete multipart metadata
      await metadataService.deleteMultipartUpload(uploadId);

      logger.info('Multipart upload aborted', { uploadId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to abort multipart upload', { uploadId, error });
      throw error;
    }
  }

  /**
   * Guess content type from file extension
   */
  private guessContentType(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      // Documents
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Text
      txt: 'text/plain',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      xml: 'application/xml',
      // Archives
      zip: 'application/zip',
      tar: 'application/x-tar',
      gz: 'application/gzip',
      // Video
      mp4: 'video/mp4',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
    };

    return ext && mimeTypes[ext] ? mimeTypes[ext] : 'application/octet-stream';
  }
}

export const multipartService = new MultipartService();
