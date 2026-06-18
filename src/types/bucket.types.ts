export interface Bucket {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BucketInfo {
  name: string;
  objectCount: number;
  totalSize: number;
  createdAt: string;
}

export interface CreateBucketRequest {
  name: string;
}

export interface CreateBucketResponse {
  bucket: {
    name: string;
    createdAt: string;
  };
}

export interface ListBucketsResponse {
  buckets: Array<{
    name: string;
    createdAt: string;
  }>;
}

export interface GetBucketResponse {
  name: string;
  objectCount: number;
  totalSize: number;
  createdAt: string;
}

export interface DeleteBucketResponse {
  message: string;
}
