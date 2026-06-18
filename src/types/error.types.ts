export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  BUCKET_NOT_FOUND = 'BUCKET_NOT_FOUND',
  BUCKET_ALREADY_EXISTS = 'BUCKET_ALREADY_EXISTS',
  BUCKET_NOT_EMPTY = 'BUCKET_NOT_EMPTY',
  OBJECT_NOT_FOUND = 'OBJECT_NOT_FOUND',
  INVALID_REQUEST = 'INVALID_REQUEST',
  UPLOAD_NOT_FOUND = 'UPLOAD_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
  };
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}
