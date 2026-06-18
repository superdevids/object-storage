import sqlite3 from 'sqlite3';
import { config } from '../config';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

const sqlite = sqlite3.verbose();

class Database {
  private db: sqlite3.Database | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      this.db = new sqlite.Database(config.dbPath, (err) => {
        if (err) {
          logger.error('Failed to connect to database', { error: err.message });
          throw err;
        }
        logger.info('Connected to SQLite database', { path: config.dbPath });
      });

      // Enable foreign keys
      this.db.run('PRAGMA foreign_keys = ON');

      // Run migrations
      this.runMigrations();
    } catch (error) {
      logger.error('Database initialization failed', { error });
      throw error;
    }
  }

  private runMigrations(): void {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Use serialize() to ensure statements run sequentially
    this.db!.serialize(() => {
      statements.forEach(statement => {
        this.db!.run(statement, (err) => {
          if (err) {
            logger.error('Migration failed', { error: err.message, statement });
          }
        });
      });

      // Log after all migrations complete
      logger.info('Database migrations completed');
    });
  }

  public getDb(): sqlite3.Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  public run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  public get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as T | undefined);
        }
      });
    });
  }

  public all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            logger.info('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

export const database = new Database();
