import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
}

export interface ListObjectsQuery {
  prefix?: string;
  limit?: string;
  cursor?: string;
}

export interface DeleteBucketQuery {
  force?: string;
}
