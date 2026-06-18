import { Router, Request, Response } from 'express';
import multer from 'multer';
import { metadataService } from '../services/metadata.service';
import { storageService } from '../services/storage.service';
import { multipartService } from '../services/multipart.service';
import { sanitizeKey } from '../utils/path.util';
import { generateETag } from '../utils/hash.util';
import { parsePrefixFolders } from '../utils/prefix.util';
import { AppError, ErrorCode } from '../types/error.types';
import {
  UploadObjectResponse,
  GetObjectMetadataResponse,
  DeleteObjectResponse,
  ListObjectsResult,
  ObjectListItem,
} from '../types/object.types';
import {
  InitiateMultipartUploadResponse,
  UploadPartResponse,
  CompleteMultipartUploadRequest,
  CompleteMultipartUploadResponse,
  AbortMultipartUploadResponse,
} from '../types/multipart.types';
import { ListObjectsQuery } from '../types/api.types';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Infinity, // No file size limit
  },
});

/**
 * PUT /buckets/:bucket/objects/:key(*) - Upload or overwrite object
 */
router.put('/:bucket/objects/:key(*)', upload.single('file'), async (req: Request, res: Response, next) => {
  try {
    const { bucket, key } = req.params;

    if (!key) {
      throw new AppError(ErrorCode.INVALID_REQUEST, 'Object key is required', 400);
    }

    const sanitizedKey = sanitizeKey(key);

    // Check if bucket exists
    const bucketExists = await metadataService.getBucket(bucket);
    if (!bucketExists) {
      throw new AppError(
        ErrorCode.BUCKET_NOT_FOUND,
        `Bucket '${bucket}' does not exist`,
        404
      );
    }

    // Get file data (either from multipart form or raw body)
    let fileData: Buffer;
    let contentType: string;

    if (req.file) {
      // Multipart form upload
      fileData = req.file.buffer;
      contentType = req.file.mimetype || 'application/octet-stream';
    } else if (req.body && Buffer.isBuffer(req.body)) {
      // Raw body upload
      fileData = req.body;
      contentType = req.headers['content-type'] || 'application/octet-stream';
    } else {
      throw new AppError(
        ErrorCode.INVALID_REQUEST,
        'No file data provided',
        400
      );
    }

    // Calculate ETag
    const etag = generateETag(fileData);

    // Write to storage
    await storageService.writeObject(bucket, sanitizedKey, fileData);

    // Create metadata
    const objectMetadata = await metadataService.createObject({
      bucketName: bucket,
      key: sanitizedKey,
      size: fileData.length,
      contentType,
      etag,
    });

    const response: UploadObjectResponse = {
      object: {
        key: objectMetadata.key,
        size: objectMetadata.size,
        etag: objectMetadata.etag,
        contentType: objectMetadata.contentType,
        updatedAt: objectMetadata.updatedAt,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /buckets/:bucket/objects/:key(*) - Download object
 */
router.get('/:bucket/objects/:key(*)', async (req: Request, res: Response, next) => {
  try {
    const { bucket, key } = req.params;

    if (!key) {
      throw new AppError(ErrorCode.INVALID_REQUEST, 'Object key is required', 400);
    }

    const sanitizedKey = sanitizeKey(key);

    // Special case: if path ends with /metadata, return metadata only
    if (req.path.endsWith('/metadata')) {
      const actualKey = sanitizedKey.replace(/\/metadata$/, '');
      const metadata = await metadataService.getObject(bucket, actualKey);

      if (!metadata) {
        throw new AppError(
          ErrorCode.OBJECT_NOT_FOUND,
          `Object '${actualKey}' not found in bucket '${bucket}'`,
          404
        );
      }

      const response: GetObjectMetadataResponse = {
        key: metadata.key,
        size: metadata.size,
        contentType: metadata.contentType,
        etag: metadata.etag,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
      };

      return res.json(response);
    }

    // Check if this is a list request (no specific key, just bucket/objects)
    if (!sanitizedKey || sanitizedKey === 'objects' || sanitizedKey === '') {
      // This should be handled by the list endpoint, but redirect here
      return next();
    }

    // Get object metadata
    const metadata = await metadataService.getObject(bucket, sanitizedKey);
    if (!metadata) {
      throw new AppError(
        ErrorCode.OBJECT_NOT_FOUND,
        `Object '${sanitizedKey}' not found in bucket '${bucket}'`,
        404
      );
    }

    // Read object from storage
    const objectData = await storageService.readObject(bucket, sanitizedKey);

    // Support Range header for partial content
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      // Parse range header (format: bytes=start-end)
      const rangeMatch = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (rangeMatch) {
        const start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0;
        const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : metadata.size - 1;

        // Validate range
        if (start >= 0 && end < metadata.size && start <= end) {
          const chunkSize = end - start + 1;
          const chunk = objectData.slice(start, end + 1);

          // Set partial content headers
          res.status(206); // Partial Content
          res.setHeader('Content-Type', metadata.contentType);
          res.setHeader('Content-Length', chunkSize);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${metadata.size}`);
          res.setHeader('ETag', metadata.etag);
          res.setHeader('Last-Modified', new Date(metadata.updatedAt).toUTCString());
          res.setHeader('Accept-Ranges', 'bytes');

          return res.send(chunk);
        }
      }

      // Invalid range, return 416
      res.status(416).setHeader('Content-Range', `bytes */${metadata.size}`);
      return res.send();
    }

    // Set response headers for full content
    res.setHeader('Content-Type', metadata.contentType);
    res.setHeader('Content-Length', metadata.size);
    res.setHeader('ETag', metadata.etag);
    res.setHeader('Last-Modified', new Date(metadata.updatedAt).toUTCString());
    res.setHeader('Accept-Ranges', 'bytes');

    // Send file data
    res.send(objectData);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /buckets/:bucket/objects - List objects with optional prefix filtering
 */
router.get('/:bucket/objects', async (req: Request, res: Response, next) => {
  try {
    const { bucket } = req.params;
    const { prefix = '', limit = '100', cursor } = req.query as ListObjectsQuery;

    // Check if bucket exists
    const bucketExists = await metadataService.getBucket(bucket);
    if (!bucketExists) {
      throw new AppError(
        ErrorCode.BUCKET_NOT_FOUND,
        `Bucket '${bucket}' does not exist`,
        404
      );
    }

    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      throw new AppError(
        ErrorCode.INVALID_REQUEST,
        'Limit must be between 1 and 1000',
        400
      );
    }

    // Get objects from metadata
    const objects = await metadataService.listObjects(
      bucket,
      prefix || '',
      limitNum + 1, // Fetch one extra to determine if there's more
      cursor
    );

    // Check if there are more results
    let nextCursor: string | null = null;
    let resultObjects = objects;

    if (objects.length > limitNum) {
      resultObjects = objects.slice(0, limitNum);
      nextCursor = resultObjects[resultObjects.length - 1].key;
    }

    // Parse folders and objects
    const allKeys = resultObjects.map(obj => obj.key);
    const { folders, objects: fileKeys } = parsePrefixFolders(allKeys, prefix || '');

    // Build object list items
    const objectItems: ObjectListItem[] = resultObjects
      .filter(obj => fileKeys.includes(obj.key))
      .map(obj => ({
        key: obj.key,
        size: obj.size,
        contentType: obj.contentType,
        updatedAt: obj.updatedAt,
        etag: obj.etag,
      }));

    const response: ListObjectsResult = {
      prefix: prefix || '',
      folders,
      objects: objectItems,
      nextCursor,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /buckets/:bucket/objects/:key(*) - Delete object
 */
router.delete('/:bucket/objects/:key(*)', async (req: Request, res: Response, next) => {
  try {
    const { bucket, key } = req.params;

    if (!key) {
      throw new AppError(ErrorCode.INVALID_REQUEST, 'Object key is required', 400);
    }

    const sanitizedKey = sanitizeKey(key);

    // Check if object exists
    const metadata = await metadataService.getObject(bucket, sanitizedKey);
    if (!metadata) {
      throw new AppError(
        ErrorCode.OBJECT_NOT_FOUND,
        `Object '${sanitizedKey}' not found in bucket '${bucket}'`,
        404
      );
    }

    // Delete from storage
    await storageService.deleteObject(bucket, sanitizedKey);

    // Delete metadata
    await metadataService.deleteObject(bucket, sanitizedKey);

    const response: DeleteObjectResponse = {
      message: `Object '${sanitizedKey}' deleted successfully`,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// ==================== MULTIPART UPLOAD ENDPOINTS ====================

/**
 * POST /buckets/:bucket/objects/:key(*)/multipart - Initiate multipart upload
 */
router.post('/:bucket/objects/:key(*)/multipart', async (req: Request, res: Response, next) => {
  try {
    const { bucket, key } = req.params;

    if (!key) {
      throw new AppError(ErrorCode.INVALID_REQUEST, 'Object key is required', 400);
    }

    const sanitizedKey = sanitizeKey(key);

    const result = await multipartService.initiate(bucket, sanitizedKey);

    const response: InitiateMultipartUploadResponse = {
      uploadId: result.uploadId,
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /buckets/:bucket/objects/:key(*)/multipart/:uploadId/parts/:partNumber - Upload part
 */
router.put(
  '/:bucket/objects/:key(*)/multipart/:uploadId/parts/:partNumber',
  upload.single('file'),
  async (req: Request, res: Response, next) => {
    try {
      const { bucket, uploadId, partNumber } = req.params;

      const partNum = parseInt(partNumber, 10);
      if (isNaN(partNum) || partNum < 1) {
        throw new AppError(
          ErrorCode.INVALID_REQUEST,
          'Part number must be a positive integer',
          400
        );
      }

      // Get file data
      let fileData: Buffer;

      if (req.file) {
        fileData = req.file.buffer;
      } else if (req.body && Buffer.isBuffer(req.body)) {
        fileData = req.body;
      } else {
        throw new AppError(
          ErrorCode.INVALID_REQUEST,
          'No file data provided',
          400
        );
      }

      const result = await multipartService.uploadPart(uploadId, partNum, fileData);

      const response: UploadPartResponse = {
        etag: result.etag,
        partNumber: partNum,
        size: result.size,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /buckets/:bucket/objects/:key(*)/multipart/:uploadId/complete - Complete multipart upload
 */
router.post(
  '/:bucket/objects/:key(*)/multipart/:uploadId/complete',
  async (req: Request, res: Response, next) => {
    try {
      const { bucket, uploadId } = req.params;
      const { parts } = req.body as CompleteMultipartUploadRequest;

      if (!parts || !Array.isArray(parts) || parts.length === 0) {
        throw new AppError(
          ErrorCode.INVALID_REQUEST,
          'Parts array is required and must not be empty',
          400
        );
      }

      const objectMetadata = await multipartService.complete(uploadId, parts);

      const response: CompleteMultipartUploadResponse = {
        object: {
          key: objectMetadata.key,
          size: objectMetadata.size,
          etag: objectMetadata.etag,
          contentType: objectMetadata.contentType,
          updatedAt: objectMetadata.updatedAt,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /buckets/:bucket/objects/:key(*)/multipart/:uploadId - Abort multipart upload
 */
router.delete(
  '/:bucket/objects/:key(*)/multipart/:uploadId',
  async (req: Request, res: Response, next) => {
    try {
      const { uploadId } = req.params;

      await multipartService.abort(uploadId);

      const response: AbortMultipartUploadResponse = {
        message: 'Multipart upload aborted successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
