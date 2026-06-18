import { Router, Request, Response } from 'express';
import { metadataService } from '../services/metadata.service';
import { storageService } from '../services/storage.service';
import { validateBucketName } from '../utils/path.util';
import { AppError, ErrorCode } from '../types/error.types';
import {
  CreateBucketRequest,
  CreateBucketResponse,
  ListBucketsResponse,
  GetBucketResponse,
  DeleteBucketResponse,
} from '../types/bucket.types';
import { DeleteBucketQuery } from '../types/api.types';

const router = Router();

/**
 * POST /buckets - Create a new bucket
 */
router.post('/', async (req: Request, res: Response, next) => {
  try {
    const { name } = req.body as CreateBucketRequest;

    // Validate bucket name
    if (!name) {
      throw new AppError(
        ErrorCode.INVALID_REQUEST,
        'Bucket name is required',
        400
      );
    }

    if (!validateBucketName(name)) {
      throw new AppError(
        ErrorCode.INVALID_REQUEST,
        'Invalid bucket name. Must be lowercase alphanumeric with hyphens, 3-63 characters',
        400
      );
    }

    // Create bucket in metadata
    const bucket = await metadataService.createBucket(name);

    // Create bucket directory in filesystem
    await storageService.ensureBucketDir(name);

    const response: CreateBucketResponse = {
      bucket: {
        name: bucket.name,
        createdAt: bucket.createdAt,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /buckets - List all buckets
 */
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const buckets = await metadataService.listBuckets();

    const response: ListBucketsResponse = {
      buckets: buckets.map(b => ({
        name: b.name,
        createdAt: b.createdAt,
      })),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /buckets/:bucket - Get bucket info
 */
router.get('/:bucket', async (req: Request, res: Response, next) => {
  try {
    const { bucket } = req.params;

    const bucketInfo = await metadataService.getBucketInfo(bucket);

    const response: GetBucketResponse = {
      name: bucketInfo.name,
      objectCount: bucketInfo.objectCount,
      totalSize: bucketInfo.totalSize,
      createdAt: bucketInfo.createdAt,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /buckets/:bucket - Delete bucket
 */
router.delete('/:bucket', async (req: Request, res: Response, next) => {
  try {
    const { bucket } = req.params;
    const { force } = req.query as DeleteBucketQuery;

    // Check if bucket exists
    const bucketExists = await metadataService.getBucket(bucket);
    if (!bucketExists) {
      throw new AppError(
        ErrorCode.BUCKET_NOT_FOUND,
        `Bucket '${bucket}' does not exist`,
        404
      );
    }

    // Check if bucket is empty (unless force=true)
    const isEmpty = await metadataService.isBucketEmpty(bucket);
    if (!isEmpty && force !== 'true') {
      throw new AppError(
        ErrorCode.BUCKET_NOT_EMPTY,
        `Bucket '${bucket}' is not empty. Use ?force=true to delete anyway`,
        409
      );
    }

    // Delete bucket from metadata (will cascade delete objects)
    await metadataService.deleteBucket(bucket);

    // Delete bucket directory from filesystem
    await storageService.deleteBucketDir(bucket);

    const response: DeleteBucketResponse = {
      message: `Bucket '${bucket}' deleted successfully`,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
