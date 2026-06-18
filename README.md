# Object Storage Server

Standalone object storage server built with Node.js + Express + TypeScript, menggunakan filesystem lokal untuk storage dan SQLite untuk metadata.

## Features

✅ **Bucket Management** - Create, list, get info, dan delete buckets  
✅ **Object Operations** - Upload, download, delete objects dengan nested path support  
✅ **Prefix-based Listing** - List objects dengan folder simulation  
✅ **Multipart Upload** - Upload file besar dengan chunking  
✅ **Range Request Support** - Partial content download (HTTP 206)  
✅ **API Key Authentication** - Simple API key via X-API-Key header  
✅ **JSON Response Format** - Consistent JSON untuk semua endpoint  
✅ **Logging** - Winston logging ke console dan file  
✅ **TypeScript Strict Mode** - Full type safety

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - HTTP server framework
- **TypeScript** - Type-safe development
- **SQLite3** - Metadata storage
- **Multer** - File upload handling
- **Winston** - Logging
- **Filesystem** - Object storage backend

## Installation

### Prerequisites

- Node.js 18+ (LTS)
- npm atau yarn

### Setup

1. Clone repository

```bash
git clone <repo-url>
cd object-storage
```

2. Install dependencies

```bash
npm install
```

3. Setup environment variables

```bash
cp .env.example .env
```

Edit `.env` file:

```env
API_KEY=your-secret-api-key-here
PORT=3000
DATA_DIR=./data
DB_PATH=./storage.db
LOG_LEVEL=info
```

4. Build TypeScript

```bash
npm run build
```

## Usage

### Development Mode

```bash
npm run dev
```

Server akan berjalan di `http://localhost:3000` dengan auto-reload.

### Production Mode

```bash
npm run build
npm start
```

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-06-18T00:00:00.000Z",
  "service": "object-storage"
}
```

## API Documentation

Semua endpoint (kecuali `/health`) memerlukan header `X-API-Key`.

### Bucket Operations

#### Create Bucket

```bash
POST /buckets
Content-Type: application/json
X-API-Key: <your-api-key>

{
  "name": "my-bucket"
}
```

Response:
```json
{
  "bucket": {
    "name": "my-bucket",
    "createdAt": "2026-06-18T00:00:00.000Z"
  }
}
```

#### List Buckets

```bash
GET /buckets
X-API-Key: <your-api-key>
```

Response:
```json
{
  "buckets": [
    {
      "name": "my-bucket",
      "createdAt": "2026-06-18T00:00:00.000Z"
    }
  ]
}
```

#### Get Bucket Info

```bash
GET /buckets/:bucket
X-API-Key: <your-api-key>
```

Response:
```json
{
  "name": "my-bucket",
  "objectCount": 10,
  "totalSize": 1048576,
  "createdAt": "2026-06-18T00:00:00.000Z"
}
```

#### Delete Bucket

```bash
DELETE /buckets/:bucket?force=true
X-API-Key: <your-api-key>
```

- Use `?force=true` to delete bucket even if not empty
- Without force, returns error if bucket contains objects

Response:
```json
{
  "message": "Bucket 'my-bucket' deleted successfully"
}
```

---

### Object Operations

#### Upload Object

```bash
PUT /buckets/:bucket/objects/:key
X-API-Key: <your-api-key>
Content-Type: multipart/form-data

file=@path/to/file.jpg
```

Or with raw body:

```bash
PUT /buckets/:bucket/objects/:key
X-API-Key: <your-api-key>
Content-Type: application/octet-stream

<binary data>
```

Response:
```json
{
  "object": {
    "key": "photos/vacation.jpg",
    "size": 102400,
    "etag": "d41d8cd98f00b204e9800998ecf8427e",
    "contentType": "image/jpeg",
    "updatedAt": "2026-06-18T00:00:00.000Z"
  }
}
```

#### Download Object

```bash
GET /buckets/:bucket/objects/:key
X-API-Key: <your-api-key>
```

Returns binary data dengan headers:
- `Content-Type`
- `Content-Length`
- `ETag`
- `Last-Modified`
- `Accept-Ranges: bytes`

#### Download with Range (Partial Content)

```bash
GET /buckets/:bucket/objects/:key
X-API-Key: <your-api-key>
Range: bytes=0-1023
```

Returns HTTP 206 Partial Content dengan headers:
- `Content-Range: bytes 0-1023/102400`

#### Get Object Metadata

```bash
GET /buckets/:bucket/objects/:key/metadata
X-API-Key: <your-api-key>
```

Response:
```json
{
  "key": "photos/vacation.jpg",
  "size": 102400,
  "contentType": "image/jpeg",
  "etag": "d41d8cd98f00b204e9800998ecf8427e",
  "createdAt": "2026-06-18T00:00:00.000Z",
  "updatedAt": "2026-06-18T00:00:00.000Z"
}
```

#### List Objects

```bash
GET /buckets/:bucket/objects?prefix=photos/&limit=50&cursor=photos/z.jpg
X-API-Key: <your-api-key>
```

Query Parameters:
- `prefix` (optional) - Filter by prefix for folder simulation
- `limit` (optional) - Max results per page (default: 100, max: 1000)
- `cursor` (optional) - Pagination cursor (last key from previous page)

Response:
```json
{
  "prefix": "photos/",
  "folders": ["photos/2024/", "photos/2025/"],
  "objects": [
    {
      "key": "photos/avatar.png",
      "size": 10240,
      "contentType": "image/png",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "etag": "abc123"
    }
  ],
  "nextCursor": "photos/zzz.png"
}
```

#### Delete Object

```bash
DELETE /buckets/:bucket/objects/:key
X-API-Key: <your-api-key>
```

Response:
```json
{
  "message": "Object 'photos/vacation.jpg' deleted successfully"
}
```

---

### Multipart Upload

Untuk upload file besar, gunakan multipart upload dengan 3 steps:

#### 1. Initiate Multipart Upload

```bash
POST /buckets/:bucket/objects/:key/multipart
X-API-Key: <your-api-key>
```

Response:
```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### 2. Upload Parts

```bash
PUT /buckets/:bucket/objects/:key/multipart/:uploadId/parts/:partNumber
X-API-Key: <your-api-key>
Content-Type: multipart/form-data

file=@part1.bin
```

Response:
```json
{
  "etag": "d41d8cd98f00b204e9800998ecf8427e",
  "partNumber": 1,
  "size": 5242880
}
```

Ulangi untuk setiap part (part 2, 3, dst).

#### 3. Complete Multipart Upload

```bash
POST /buckets/:bucket/objects/:key/multipart/:uploadId/complete
X-API-Key: <your-api-key>
Content-Type: application/json

{
  "parts": [1, 2, 3]
}
```

Response:
```json
{
  "object": {
    "key": "large-file.bin",
    "size": 15728640,
    "etag": "abc123def456",
    "contentType": "application/octet-stream",
    "updatedAt": "2026-06-18T00:00:00.000Z"
  }
}
```

#### Abort Multipart Upload

```bash
DELETE /buckets/:bucket/objects/:key/multipart/:uploadId
X-API-Key: <your-api-key>
```

Response:
```json
{
  "message": "Multipart upload aborted successfully"
}
```

---

## Error Responses

Semua error dikembalikan dalam format JSON konsisten:

```json
{
  "error": {
    "code": "BUCKET_NOT_FOUND",
    "message": "Bucket 'xyz' does not exist"
  }
}
```

Error Codes:
- `UNAUTHORIZED` (401) - Invalid or missing API key
- `BUCKET_NOT_FOUND` (404) - Bucket does not exist
- `BUCKET_ALREADY_EXISTS` (409) - Bucket already exists
- `BUCKET_NOT_EMPTY` (409) - Bucket not empty (use force=true)
- `OBJECT_NOT_FOUND` (404) - Object does not exist
- `UPLOAD_NOT_FOUND` (404) - Multipart upload not found
- `INVALID_REQUEST` (400) - Invalid request parameters
- `INTERNAL_ERROR` (500) - Server error

---

## Project Structure

```
object-storage/
├── src/
│   ├── server.ts              # Express app entry point
│   ├── config.ts              # Environment configuration
│   ├── types/                 # TypeScript type definitions
│   │   ├── bucket.types.ts
│   │   ├── object.types.ts
│   │   ├── multipart.types.ts
│   │   ├── error.types.ts
│   │   └── api.types.ts
│   ├── routes/                # API route handlers
│   │   ├── bucket.routes.ts
│   │   └── object.routes.ts
│   ├── middleware/            # Express middleware
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── logger.middleware.ts
│   ├── services/              # Business logic layer
│   │   ├── storage.service.ts    # Filesystem operations
│   │   ├── metadata.service.ts   # SQLite operations
│   │   └── multipart.service.ts  # Multipart orchestration
│   ├── db/                    # Database setup
│   │   ├── schema.sql
│   │   └── client.ts
│   └── utils/                 # Utility functions
│       ├── logger.ts
│       ├── hash.util.ts
│       ├── path.util.ts
│       └── prefix.util.ts
├── data/                      # Object storage (gitignored)
├── tests/                     # Test scripts
│   └── curl-examples.sh
├── .env                       # Environment variables (gitignored)
├── .env.example               # Example env file
├── tsconfig.json              # TypeScript config
├── package.json
└── README.md
```

---

## Design Decisions

### 1. SQLite vs File JSON for Metadata

**Dipilih SQLite** karena:
- Query lebih cepat dengan index
- Mendukung foreign key constraints
- Scalable untuk filtering dan pagination
- Built-in ACID compliance

### 2. Filesystem Structure

```
data/
├── my-bucket/
│   ├── file1.txt
│   └── photos/
│       └── vacation.jpg
└── .multipart-tmp/
    └── <upload-id>/
        ├── part-1
        └── part-2
```

- Simple dan mirror struktur logical
- Multipart parts isolated di temp directory
- Easy cleanup setelah complete/abort

### 3. ETag Strategy

- Menggunakan MD5 hash dari file content
- Standard de facto untuk object storage
- Generated saat upload, stored di metadata

### 4. Prefix/Folder Simulation

- Parse key dengan delimiter `/`
- Group by prefix level untuk folder browsing
- Response terpisah antara `folders` dan `objects`

### 5. Multipart Merge

- Stream-based concatenation (memory efficient)
- Validate semua parts ada sebelum merge
- Atomic operation: merge ke temp → rename

---

## Testing

### Manual Testing with cURL

```bash
cd tests
chmod +x curl-examples.sh
./curl-examples.sh
```

Script akan menjalankan:
1. Create bucket
2. Upload objects
3. List dengan prefix
4. Download objects
5. Multipart upload
6. Delete operations

---

## Development

### Run in Development Mode

```bash
npm run dev
```

Auto-reload dengan `tsx watch`.

### Build for Production

```bash
npm run build
```

Output ke `dist/` folder.

### Logs

Logs disimpan di:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console - Colored output

---

## Future Enhancements

Fitur yang bisa ditambahkan:

- [ ] Multi-user dengan tabel `api_keys`
- [ ] Custom metadata per-object
- [ ] Object versioning
- [ ] Lifecycle policies (auto-delete old objects)
- [ ] Cloud storage backend (S3, GCS, Azure Blob)
- [ ] Object compression
- [ ] CDN integration
- [ ] Rate limiting
- [ ] Metrics dan monitoring
- [ ] Web UI dashboard

---

## License

ISC

---

## Author

VibeCoding Project

---

## Support

Untuk issue atau pertanyaan, silakan buat issue di repository.
