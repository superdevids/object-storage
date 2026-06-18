# Prompt: Build Standalone Object Storage Server (Node.js + Express)

## Context

Saya ingin membangun object storage server **versi sendiri** — bukan untuk meniru atau kompatibel dengan AWS S3 (jadi TIDAK perlu signature AWS SigV4, TIDAK perlu format XML ala S3, TIDAK perlu bisa dipakai AWS SDK). Ini adalah sistem standalone dengan desain API, auth, dan response format sendiri yang sederhana dan langsung dipakai untuk kebutuhan saya sendiri (personal/internal project).

Tech stack: Node.js + Express, dengan backend penyimpanan berupa **filesystem lokal**, response format **JSON**, dan auth memakai **API key sederhana**.

## Requirements

### 1. Tech Stack

- Node.js (versi LTS terbaru)
- Express.js sebagai HTTP server
- Filesystem lokal sebagai storage backend (data fisik disimpan di folder, misal `./data/<bucket>/<key>`)
- Metadata disimpan terpisah — bisa pakai SQLite (disarankan, lebih scalable untuk listing/filter/query) berisi: nama bucket, key, size, content-type, ETag/hash, createdAt, updatedAt, custom metadata (key-value bebas)
- Response format: **JSON** di semua endpoint (sukses maupun error)
- Gunakan TypeScript (bukan plain JavaScript) untuk seluruh codebase — termasuk strict typing untuk request/response shape, model data (Bucket, ObjectMetadata, MultipartUpload, dll), dan konfigurasi `tsconfig.json` dengan `strict: true`.

### 2. Authentication — API Key Sederhana

- Setiap request harus menyertakan API key, bisa via header custom, misal: `X-API-Key: <key>`
- Untuk awal: cukup 1 API key yang disimpan di environment variable (`.env`)
- Desain sedemikian rupa supaya nanti mudah dikembangkan jadi multi-key/multi-user (misal tabel `api_keys` di SQLite dengan kolom `key`, `name`, `createdAt`, `permissions`), meskipun untuk versi awal cukup 1 key hardcoded dari `.env`
- Request tanpa API key atau dengan key salah harus ditolak dengan response JSON konsisten, contoh:
  ```json
  { "error": { "code": "UNAUTHORIZED", "message": "Invalid or missing API key" } }
  ```

### 3. API Endpoints (REST + JSON)

**Bucket operations:**

- `POST /buckets` — create bucket — body: `{ "name": "my-bucket" }`
- `GET /buckets` — list semua bucket
- `GET /buckets/:bucket` — get info bucket (jumlah object, total size, createdAt)
- `DELETE /buckets/:bucket` — delete bucket (tolak kalau masih ada object di dalamnya, kecuali ada query `?force=true`)

**Object operations:**

- `PUT /buckets/:bucket/objects/:key` — upload/overwrite object (body: binary/file, terima via `multipart/form-data` atau raw body dengan `Content-Type` sesuai file)
- `GET /buckets/:bucket/objects/:key` — download object (kembalikan file langsung dengan header `Content-Type` & `Content-Length` yang benar, support `Range` header untuk partial download)
- `GET /buckets/:bucket/objects/:key/metadata` — get metadata object saja (JSON, tanpa download file)
- `DELETE /buckets/:bucket/objects/:key` — delete object
- `GET /buckets/:bucket/objects` — list objects, dengan query param:
  - `?prefix=folder/` — filter berdasarkan prefix (untuk simulasi folder)
  - `?limit=50&cursor=...` — pagination
  - Response harus mengelompokkan hasil supaya bisa dipakai untuk **folder/prefix browsing**, contoh response:
    ```json
    {
    	"prefix": "photos/",
    	"folders": ["photos/2024/", "photos/2025/"],
    	"objects": [{ "key": "photos/avatar.png", "size": 10240, "contentType": "image/png", "updatedAt": "..." }],
    	"nextCursor": null
    }
    ```

**Multipart upload (untuk file besar):**

- `POST /buckets/:bucket/objects/:key/multipart` — initiate multipart upload → return `uploadId`
- `PUT /buckets/:bucket/objects/:key/multipart/:uploadId/parts/:partNumber` — upload satu part (body: binary chunk)
- `POST /buckets/:bucket/objects/:key/multipart/:uploadId/complete` — gabungkan semua part jadi 1 file final, body: `{ "parts": [1, 2, 3] }` untuk validasi urutan & kelengkapan
- `DELETE /buckets/:bucket/objects/:key/multipart/:uploadId` — abort multipart upload, hapus semua part sementara
- Part sementara disimpan di folder temp terpisah (misal `./data/.multipart-tmp/<uploadId>/`) sebelum di-merge ke lokasi final

### 4. Response Format & Konsistensi

- Semua response sukses dan error harus JSON.
- Format error konsisten di semua endpoint:
  ```json
  { "error": { "code": "BUCKET_NOT_FOUND", "message": "Bucket 'xyz' does not exist" } }
  ```
- Daftar error code yang perlu ada: `UNAUTHORIZED`, `BUCKET_NOT_FOUND`, `BUCKET_ALREADY_EXISTS`, `BUCKET_NOT_EMPTY`, `OBJECT_NOT_FOUND`, `INVALID_REQUEST`, `UPLOAD_NOT_FOUND` (untuk multipart), `INTERNAL_ERROR`.
- Setiap response sukses untuk operasi tulis (upload/delete/create) sebaiknya mengembalikan representasi resource terkait, bukan cuma `{ "success": true }` polos.

### 5. Struktur Project yang Diharapkan

```
object-storage/
├── src/
│   ├── server.js                 # entry point Express
│   ├── routes/
│   │   ├── bucket.routes.js
│   │   └── object.routes.js
│   ├── middleware/
│   │   ├── auth.js               # validasi API key
│   │   └── error-handler.js      # konversi error jadi JSON response konsisten
│   ├── services/
│   │   ├── storage.service.js    # baca/tulis filesystem
│   │   ├── metadata.service.js   # query/update SQLite
│   │   └── multipart.service.js  # kelola part sementara & merge
│   ├── db/
│   │   ├── schema.sql            # definisi tabel SQLite
│   │   └── client.js
│   └── config.js
├── data/                          # folder penyimpanan object fisik (gitignored)
├── .env.example
├── package.json
└── README.md
```

### 6. Testing & Verifikasi

- Sertakan contoh script test (pakai `node-fetch`/`axios` atau native `fetch`) yang melakukan: create bucket, upload object kecil, upload object besar via multipart, list dengan prefix, download, delete — untuk memastikan semua endpoint jalan end-to-end.
- Sertakan juga contoh request pakai `curl` di README untuk setiap endpoint.

## Cara Kerja yang Diinginkan

1. Mulai dari setup project, struktur folder, dan koneksi SQLite (schema bucket + object + multipart_parts).
2. Implementasi dulu bucket CRUD + object CRUD basic (upload, download, delete, get metadata) — test manual dulu sebelum lanjut.
3. Tambahkan middleware auth API key.
4. Implementasi list objects dengan prefix filtering + folder simulation.
5. Terakhir, implementasi multipart upload (initiate → upload parts → complete/abort).
6. Setiap tahap, jelaskan singkat keputusan desain yang diambil (misal: kenapa pakai SQLite vs file JSON untuk metadata, kenapa struktur folder data begitu), supaya saya paham bukan cuma terima kode jadi.

## Catatan Tambahan

- Saya familiar dengan JavaScript/Node.js, jadi tidak perlu jelaskan dasar-dasar JS/Express.
- Ini BUKAN proyek S3-compatible — jangan tambahkan SigV4, XML response, atau hal lain yang spesifik ke AWS S3 spec.
- Prioritaskan desain yang simple, jelas, dan mudah di-extend nanti (misal kalau suatu saat mau ganti backend dari filesystem ke cloud storage, atau dari API key tunggal ke multi-user).
- Boleh pakai library bantu untuk hal generik (`multer` untuk handle multipart/form-data, `better-sqlite3` atau `sqlite3` untuk metadata store, `crypto` built-in Node.js untuk hashing), tapi logika inti (storage service, metadata service, multipart merge) sebaiknya custom dibuat sendiri agar saya paham cara kerjanya.
- Pastikan semua interface/type didefinisikan secara eksplisit (hindari `any`), terutama untuk payload request body, response JSON, dan return value dari service layer (storage.service, metadata.service, multipart.service).
