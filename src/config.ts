import dotenv from 'dotenv';
import path from 'path';

// Load .env from root directory (works in both dev and production)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface Config {
  apiKey: string;
  port: number;
  dataDir: string;
  dbPath: string;
  logLevel: string;
}

function validateConfig(): Config {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error('ERROR: API_KEY environment variable is required');
    console.error('Current working directory:', process.cwd());
    console.error('Environment variables:', Object.keys(process.env).filter(k => k.includes('API')));
    throw new Error('API_KEY environment variable is required');
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  if (isNaN(port)) {
    throw new Error('PORT must be a valid number');
  }

  const dataDir = path.resolve(process.env.DATA_DIR || './data');
  const dbPath = path.resolve(process.env.DB_PATH || './storage.db');
  const logLevel = process.env.LOG_LEVEL || 'info';

  // Log loaded config (without sensitive data)
  console.log('Configuration loaded:', {
    apiKeyLength: apiKey.length,
    port,
    dataDir,
    dbPath,
    logLevel
  });

  return {
    apiKey,
    port,
    dataDir,
    dbPath,
    logLevel,
  };
}

export const config = validateConfig();
