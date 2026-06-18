export interface ObjectMetadata {
  id: number;
  bucketName: string;
  key: string;
  size: number;
  contentType: string;
  etag: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface ObjectListItem {
  key: string;
  size: number;
  contentType: string;
  updatedAt: string;
  etag: string;
}

export interface ListObjectsResult {
  prefix: string;
  folders: string[];
  objects: ObjectListItem[];
  nextCursor: string | null;
}

export interface CreateObjectDto {
  bucketName: string;
  key: string;
  size: number;
  contentType: string;
  etag: string;
  metadata?: Record<string, string>;
}

export interface UploadObjectResponse {
  object: {
    key: string;
    size: number;
    etag: string;
    contentType: string;
    updatedAt: string;
  };
}

export interface GetObjectMetadataResponse {
  key: string;
  size: number;
  contentType: string;
  etag: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeleteObjectResponse {
  message: string;
}
