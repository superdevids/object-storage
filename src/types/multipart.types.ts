export interface MultipartUpload {
  id: number;
  uploadId: string;
  bucketName: string;
  key: string;
  createdAt: string;
}

export interface MultipartPart {
  id: number;
  uploadId: string;
  partNumber: number;
  size: number;
  etag: string;
  uploadedAt: string;
}

export interface InitiateMultipartUploadResponse {
  uploadId: string;
}

export interface UploadPartResponse {
  etag: string;
  partNumber: number;
  size: number;
}

export interface CompleteMultipartUploadRequest {
  parts: number[];
}

export interface CompleteMultipartUploadResponse {
  object: {
    key: string;
    size: number;
    etag: string;
    contentType: string;
    updatedAt: string;
  };
}

export interface AbortMultipartUploadResponse {
  message: string;
}
