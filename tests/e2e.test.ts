/**
 * End-to-End Test Suite for Object Storage Server
 * 
 * Prerequisites:
 * - Server must be running on http://localhost:3000
 * - API_KEY must match the server's configured key
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

const API_KEY = process.env.API_KEY || 'dev-secret-key-12345';
const BASE_URL = 'http://localhost:3000';
const TEST_BUCKET = 'test-bucket-' + Date.now();

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

// Helper function to make HTTP requests
function makeRequest(
  method: string,
  path: string,
  data?: any,
  headers?: Record<string, string>
): Promise<{ status: number; body: any; headers: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isJson = data && typeof data === 'object' && !Buffer.isBuffer(data);
    
    const options: http.RequestOptions = {
      method,
      headers: {
        'X-API-Key': API_KEY,
        ...headers,
      },
    };

    if (isJson) {
      options.headers!['Content-Type'] = 'application/json';
    }

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsedBody = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode!, body: parsedBody, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode!, body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      if (Buffer.isBuffer(data)) {
        req.write(data);
      } else if (typeof data === 'string') {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }

    req.end();
  });
}

// Test runner
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`✅ ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, error: error.message, duration });
    console.error(`❌ ${name} (${duration}ms)`);
    console.error(`   Error: ${error.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// Test Suite
async function runTests() {
  console.log('========================================');
  console.log('Object Storage E2E Test Suite');
  console.log('========================================\n');

  // Test 1: Health Check
  await test('Health check endpoint', async () => {
    const res = await makeRequest('GET', '/health');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.status === 'ok', 'Status should be ok');
    assert(res.body.service === 'object-storage', 'Service name should match');
  });

  // Test 2: Create Bucket
  await test('Create bucket', async () => {
    const res = await makeRequest('POST', '/buckets', { name: TEST_BUCKET });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.body.bucket.name === TEST_BUCKET, 'Bucket name should match');
    assert(res.body.bucket.createdAt, 'Should have createdAt timestamp');
  });

  // Test 3: Create Duplicate Bucket (should fail)
  await test('Create duplicate bucket (should fail)', async () => {
    const res = await makeRequest('POST', '/buckets', { name: TEST_BUCKET });
    assert(res.status === 409, `Expected 409, got ${res.status}`);
    assert(res.body.error.code === 'BUCKET_ALREADY_EXISTS', 'Should return BUCKET_ALREADY_EXISTS error');
  });

  // Test 4: List Buckets
  await test('List buckets', async () => {
    const res = await makeRequest('GET', '/buckets');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.buckets), 'Should return buckets array');
    assert(res.body.buckets.length > 0, 'Should have at least one bucket');
    const found = res.body.buckets.find((b: any) => b.name === TEST_BUCKET);
    assert(found, 'Should find test bucket in list');
  });

  // Test 5: Get Bucket Info
  await test('Get bucket info', async () => {
    const res = await makeRequest('GET', `/buckets/${TEST_BUCKET}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.name === TEST_BUCKET, 'Bucket name should match');
    assert(res.body.objectCount === 0, 'New bucket should have 0 objects');
    assert(res.body.totalSize === 0, 'New bucket should have 0 total size');
  });

  // Test 6: Upload Small Object
  const testContent = 'Hello, Object Storage! This is a test file.';
  await test('Upload small object', async () => {
    const res = await makeRequest(
      'PUT',
      `/buckets/${TEST_BUCKET}/objects/test.txt`,
      Buffer.from(testContent),
      { 'Content-Type': 'text/plain' }
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.object.key === 'test.txt', 'Object key should match');
    assert(res.body.object.size === testContent.length, 'Object size should match');
    assert(res.body.object.etag, 'Should have ETag');
  });

  // Test 7: Upload Nested Object
  await test('Upload nested object', async () => {
    const res = await makeRequest(
      'PUT',
      `/buckets/${TEST_BUCKET}/objects/docs/readme.txt`,
      Buffer.from('README content'),
      { 'Content-Type': 'text/plain' }
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.object.key === 'docs/readme.txt', 'Nested key should match');
  });

  // Test 8: Upload Another Nested Object
  await test('Upload another nested object', async () => {
    const res = await makeRequest(
      'PUT',
      `/buckets/${TEST_BUCKET}/objects/docs/api.txt`,
      Buffer.from('API docs'),
      { 'Content-Type': 'text/plain' }
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // Test 9: List Objects
  await test('List all objects', async () => {
    const res = await makeRequest('GET', `/buckets/${TEST_BUCKET}/objects`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.objects.length >= 1, 'Should have at least one object');
    assert(res.body.folders.includes('docs/'), 'Should have docs/ folder');
  });

  // Test 10: List Objects with Prefix
  await test('List objects with prefix', async () => {
    const res = await makeRequest('GET', `/buckets/${TEST_BUCKET}/objects?prefix=docs/`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.prefix === 'docs/', 'Prefix should match');
    assert(res.body.objects.length === 2, 'Should have 2 objects in docs/');
  });

  // Test 11: Get Object Metadata
  await test('Get object metadata', async () => {
    const res = await makeRequest('GET', `/buckets/${TEST_BUCKET}/objects/test.txt/metadata`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.key === 'test.txt', 'Key should match');
    assert(res.body.size === testContent.length, 'Size should match');
    assert(res.body.contentType === 'text/plain', 'Content type should match');
  });

  // Test 12: Download Object
  await test('Download object', async () => {
    const res = await makeRequest('GET', `/buckets/${TEST_BUCKET}/objects/test.txt`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body === testContent, 'Downloaded content should match uploaded content');
  });

  // Test 13: Download with Range Header
  await test('Download with range header', async () => {
    const res = await makeRequest('GET', `/buckets/${TEST_BUCKET}/objects/test.txt`, undefined, {
      'Range': 'bytes=0-9',
    });
    assert(res.status === 206, `Expected 206, got ${res.status}`);
    assert(res.body === testContent.substring(0, 10), 'Partial content should match');
    assert(res.headers['content-range'], 'Should have Content-Range header');
  });

  // Test 14: Multipart Upload - Initiate
  let uploadId: string;
  await test('Initiate multipart upload', async () => {
    const res = await makeRequest('POST', `/buckets/${TEST_BUCKET}/objects/large-file.bin/multipart`);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.body.uploadId, 'Should return uploadId');
    uploadId = res.body.uploadId;
  });

  // Test 15: Multipart Upload - Upload Part 1
  const part1 = randomBytes(1024 * 100); // 100KB
  await test('Upload multipart part 1', async () => {
    const res = await makeRequest(
      'PUT',
      `/buckets/${TEST_BUCKET}/objects/large-file.bin/multipart/${uploadId}/parts/1`,
      part1,
      { 'Content-Type': 'application/octet-stream' }
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.partNumber === 1, 'Part number should be 1');
    assert(res.body.etag, 'Should have ETag');
    assert(res.body.size === part1.length, 'Part size should match');
  });

  // Test 16: Multipart Upload - Upload Part 2
  const part2 = randomBytes(1024 * 100); // 100KB
  await test('Upload multipart part 2', async () => {
    const res = await makeRequest(
      'PUT',
      `/buckets/${TEST_BUCKET}/objects/large-file.bin/multipart/${uploadId}/parts/2`,
      part2,
      { 'Content-Type': 'application/octet-stream' }
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.partNumber === 2, 'Part number should be 2');
  });

  // Test 17: Multipart Upload - Complete
  await test('Complete multipart upload', async () => {
    const res = await makeRequest(
      'POST',
      `/buckets/${TEST_BUCKET}/objects/large-file.bin/multipart/${uploadId}/complete`,
      { parts: [1, 2] }
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.object.key === 'large-file.bin', 'Object key should match');
    assert(res.body.object.size === part1.length + part2.length, 'Total size should match');
  });

  // Test 18: Verify Multipart Object Exists
  await test('Verify multipart object exists', async () => {
    const res = await makeRequest('GET', `/buckets/${TEST_BUCKET}/objects/large-file.bin/metadata`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.size === part1.length + part2.length, 'Size should match merged parts');
  });

  // Test 19: Delete Object
  await test('Delete object', async () => {
    const res = await makeRequest('DELETE', `/buckets/${TEST_BUCKET}/objects/test.txt`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.message.includes('deleted'), 'Should confirm deletion');
  });

  // Test 20: Verify Object Deleted
  await test('Verify object deleted', async () => {
    const res = await makeRequest('GET', `/buckets/${TEST_BUCKET}/objects/test.txt`);
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  // Test 21: Delete Bucket (should fail - not empty)
  await test('Delete non-empty bucket (should fail)', async () => {
    const res = await makeRequest('DELETE', `/buckets/${TEST_BUCKET}`);
    assert(res.status === 409, `Expected 409, got ${res.status}`);
    assert(res.body.error.code === 'BUCKET_NOT_EMPTY', 'Should return BUCKET_NOT_EMPTY error');
  });

  // Test 22: Delete Bucket with Force
  await test('Delete bucket with force', async () => {
    const res = await makeRequest('DELETE', `/buckets/${TEST_BUCKET}?force=true`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.message.includes('deleted'), 'Should confirm deletion');
  });

  // Test 23: Verify Bucket Deleted
  await test('Verify bucket deleted', async () => {
    const res = await makeRequest('GET', `/buckets/${TEST_BUCKET}`);
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  // Test 24: Unauthorized Request (no API key)
  await test('Unauthorized request (no API key)', async () => {
    const res = await makeRequest('GET', '/buckets', undefined, { 'X-API-Key': '' });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
    assert(res.body.error.code === 'UNAUTHORIZED', 'Should return UNAUTHORIZED error');
  });

  // Print Summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total Time: ${totalTime}ms`);
  console.log('========================================\n');

  if (failed > 0) {
    console.log('Failed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log('All tests passed! ✅');
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
