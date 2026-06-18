#!/bin/bash

# Object Storage Server - cURL Examples
# Make sure to set your API key in X-API-Key header

API_KEY="dev-secret-key-12345"
BASE_URL="http://localhost:3000"

echo "=========================================="
echo "Object Storage Server - cURL Examples"
echo "=========================================="
echo ""

# Health Check
echo "1. Health Check"
echo "curl $BASE_URL/health"
curl -s $BASE_URL/health | jq .
echo ""
echo ""

# Create Bucket
echo "2. Create Bucket"
echo "curl -X POST $BASE_URL/buckets -H 'X-API-Key: $API_KEY' -H 'Content-Type: application/json' -d '{\"name\": \"test-bucket\"}'"
curl -s -X POST $BASE_URL/buckets \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-bucket"}' | jq .
echo ""
echo ""

# List Buckets
echo "3. List Buckets"
echo "curl $BASE_URL/buckets -H 'X-API-Key: $API_KEY'"
curl -s $BASE_URL/buckets \
  -H "X-API-Key: $API_KEY" | jq .
echo ""
echo ""

# Get Bucket Info
echo "4. Get Bucket Info"
echo "curl $BASE_URL/buckets/test-bucket -H 'X-API-Key: $API_KEY'"
curl -s $BASE_URL/buckets/test-bucket \
  -H "X-API-Key: $API_KEY" | jq .
echo ""
echo ""

# Upload Object
echo "5. Upload Object (text file)"
echo "echo 'Hello, Object Storage!' > test.txt"
echo "curl -X PUT $BASE_URL/buckets/test-bucket/objects/test.txt -H 'X-API-Key: $API_KEY' -F 'file=@test.txt'"
echo "Hello, Object Storage!" > test.txt
curl -s -X PUT $BASE_URL/buckets/test-bucket/objects/test.txt \
  -H "X-API-Key: $API_KEY" \
  -F "file=@test.txt" | jq .
echo ""
echo ""

# Upload Nested Object
echo "6. Upload Nested Object"
echo "curl -X PUT $BASE_URL/buckets/test-bucket/objects/docs/readme.txt -H 'X-API-Key: $API_KEY' -F 'file=@test.txt'"
curl -s -X PUT $BASE_URL/buckets/test-bucket/objects/docs/readme.txt \
  -H "X-API-Key: $API_KEY" \
  -F "file=@test.txt" | jq .
echo ""
echo ""

# List Objects
echo "7. List All Objects"
echo "curl $BASE_URL/buckets/test-bucket/objects -H 'X-API-Key: $API_KEY'"
curl -s $BASE_URL/buckets/test-bucket/objects \
  -H "X-API-Key: $API_KEY" | jq .
echo ""
echo ""

# List Objects with Prefix
echo "8. List Objects with Prefix"
echo "curl '$BASE_URL/buckets/test-bucket/objects?prefix=docs/' -H 'X-API-Key: $API_KEY'"
curl -s "$BASE_URL/buckets/test-bucket/objects?prefix=docs/" \
  -H "X-API-Key: $API_KEY" | jq .
echo ""
echo ""

# Get Object Metadata
echo "9. Get Object Metadata"
echo "curl $BASE_URL/buckets/test-bucket/objects/test.txt/metadata -H 'X-API-Key: $API_KEY'"
curl -s $BASE_URL/buckets/test-bucket/objects/test.txt/metadata \
  -H "X-API-Key: $API_KEY" | jq .
echo ""
echo ""

# Download Object
echo "10. Download Object"
echo "curl $BASE_URL/buckets/test-bucket/objects/test.txt -H 'X-API-Key: $API_KEY'"
curl -s $BASE_URL/buckets/test-bucket/objects/test.txt \
  -H "X-API-Key: $API_KEY"
echo ""
echo ""

# Download Object with Range Header
echo "11. Download Object with Range Header (first 10 bytes)"
echo "curl $BASE_URL/buckets/test-bucket/objects/test.txt -H 'X-API-Key: $API_KEY' -H 'Range: bytes=0-9'"
curl -s $BASE_URL/buckets/test-bucket/objects/test.txt \
  -H "X-API-Key: $API_KEY" \
  -H "Range: bytes=0-9"
echo ""
echo ""

# Initiate Multipart Upload
echo "12. Initiate Multipart Upload"
echo "curl -X POST $BASE_URL/buckets/test-bucket/objects/large-file.bin/multipart -H 'X-API-Key: $API_KEY'"
UPLOAD_ID=$(curl -s -X POST $BASE_URL/buckets/test-bucket/objects/large-file.bin/multipart \
  -H "X-API-Key: $API_KEY" | jq -r '.uploadId')
echo "Upload ID: $UPLOAD_ID"
echo ""
echo ""

# Upload Part 1
echo "13. Upload Part 1"
echo "dd if=/dev/zero of=part1.bin bs=1M count=5"
echo "curl -X PUT $BASE_URL/buckets/test-bucket/objects/large-file.bin/multipart/$UPLOAD_ID/parts/1 -H 'X-API-Key: $API_KEY' -F 'file=@part1.bin'"
dd if=/dev/zero of=part1.bin bs=1M count=5 2>/dev/null
curl -s -X PUT "$BASE_URL/buckets/test-bucket/objects/large-file.bin/multipart/$UPLOAD_ID/parts/1" \
  -H "X-API-Key: $API_KEY" \
  -F "file=@part1.bin" | jq .
echo ""
echo ""

# Upload Part 2
echo "14. Upload Part 2"
echo "dd if=/dev/zero of=part2.bin bs=1M count=5"
echo "curl -X PUT $BASE_URL/buckets/test-bucket/objects/large-file.bin/multipart/$UPLOAD_ID/parts/2 -H 'X-API-Key: $API_KEY' -F 'file=@part2.bin'"
dd if=/dev/zero of=part2.bin bs=1M count=5 2>/dev/null
curl -s -X PUT "$BASE_URL/buckets/test-bucket/objects/large-file.bin/multipart/$UPLOAD_ID/parts/2" \
  -H "X-API-Key: $API_KEY" \
  -F "file=@part2.bin" | jq .
echo ""
echo ""

# Complete Multipart Upload
echo "15. Complete Multipart Upload"
echo "curl -X POST $BASE_URL/buckets/test-bucket/objects/large-file.bin/multipart/$UPLOAD_ID/complete -H 'X-API-Key: $API_KEY' -H 'Content-Type: application/json' -d '{\"parts\": [1, 2]}'"
curl -s -X POST "$BASE_URL/buckets/test-bucket/objects/large-file.bin/multipart/$UPLOAD_ID/complete" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"parts": [1, 2]}' | jq .
echo ""
echo ""

# Delete Object
echo "16. Delete Object"
echo "curl -X DELETE $BASE_URL/buckets/test-bucket/objects/test.txt -H 'X-API-Key: $API_KEY'"
curl -s -X DELETE $BASE_URL/buckets/test-bucket/objects/test.txt \
  -H "X-API-Key: $API_KEY" | jq .
echo ""
echo ""

# Delete Bucket (will fail if not empty)
echo "17. Delete Bucket (without force, should fail)"
echo "curl -X DELETE $BASE_URL/buckets/test-bucket -H 'X-API-Key: $API_KEY'"
curl -s -X DELETE $BASE_URL/buckets/test-bucket \
  -H "X-API-Key: $API_KEY" | jq .
echo ""
echo ""

# Delete Bucket with Force
echo "18. Delete Bucket (with force=true)"
echo "curl -X DELETE '$BASE_URL/buckets/test-bucket?force=true' -H 'X-API-Key: $API_KEY'"
curl -s -X DELETE "$BASE_URL/buckets/test-bucket?force=true" \
  -H "X-API-Key: $API_KEY" | jq .
echo ""
echo ""

# Cleanup
echo "Cleaning up test files..."
rm -f test.txt part1.bin part2.bin
echo "Done!"
