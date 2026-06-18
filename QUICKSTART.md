# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env and set your API key
# API_KEY=your-secret-api-key-here
```

### 3. Build Project

```bash
npm run build
```

### 4. Start Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server akan berjalan di **http://localhost:3000**

### 5. Test Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-06-18T00:35:00.000Z",
  "service": "object-storage"
}
```

---

## 📝 Quick Test

### Create a Bucket

```bash
curl -X POST http://localhost:3000/buckets \
  -H "X-API-Key: dev-secret-key-12345" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-first-bucket"}'
```

### Upload a File

```bash
echo "Hello World!" > test.txt

curl -X PUT http://localhost:3000/buckets/my-first-bucket/objects/test.txt \
  -H "X-API-Key: dev-secret-key-12345" \
  -F "file=@test.txt"
```

### Download the File

```bash
curl http://localhost:3000/buckets/my-first-bucket/objects/test.txt \
  -H "X-API-Key: dev-secret-key-12345"
```

### List Objects

```bash
curl http://localhost:3000/buckets/my-first-bucket/objects \
  -H "X-API-Key: dev-secret-key-12345"
```

---

## 🧪 Run Complete Test Suite

```bash
# Start server first (in another terminal)
npm run dev

# Run tests
npm test
```

Or use the shell script (Linux/Mac/Git Bash):

```bash
cd tests
chmod +x curl-examples.sh
./curl-examples.sh
```

---

## 📁 Project Structure

```
src/
├── server.ts              # Main entry point
├── config.ts              # Configuration
├── types/                 # TypeScript types
├── routes/                # API endpoints
├── middleware/            # Auth & error handling
├── services/              # Business logic
├── db/                    # Database setup
└── utils/                 # Helper functions
```

---

## 🔑 API Authentication

All endpoints (except `/health`) require the `X-API-Key` header:

```bash
X-API-Key: your-secret-api-key-here
```

Set your API key in `.env`:

```env
API_KEY=your-secret-api-key-here
```

---

## 📚 Documentation

Full API documentation tersedia di [README.md](./README.md)

---

## 🐛 Troubleshooting

### Port already in use

Change the port in `.env`:

```env
PORT=3001
```

### Database locked error

Stop all running instances dan hapus `storage.db.lock` jika ada:

```bash
rm storage.db-journal
```

### Permission denied (logs directory)

Create logs directory manually:

```bash
mkdir logs
```

---

## 🎯 What's Next?

- Explore all API endpoints di README.md
- Run full test suite dengan `npm test`
- Check logs di `logs/combined.log`
- Try multipart upload untuk file besar
- Implement custom features

---

Selamat menggunakan Object Storage Server! 🎉
