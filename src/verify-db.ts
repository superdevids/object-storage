import { database } from './db/client';
import { logger } from './utils/logger';

async function verifyDatabase() {
  try {
    logger.info('Verifying database schema...');

    // Wait a bit for migrations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check tables exist
    const tables = await database.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );

    logger.info('Tables found:', { tables: tables.map(t => t.name) });

    // Check indexes exist
    const indexes = await database.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' ORDER BY name"
    );

    logger.info('Indexes found:', { indexes: indexes.map(i => i.name) });

    // Verify expected tables
    const expectedTables = ['api_keys', 'buckets', 'multipart_parts', 'multipart_uploads', 'objects'];
    const foundTables = tables.map(t => t.name);
    
    const allTablesExist = expectedTables.every(table => foundTables.includes(table));
    
    if (allTablesExist) {
      logger.info('✅ All expected tables created successfully!');
    } else {
      logger.error('❌ Some tables missing!', {
        expected: expectedTables,
        found: foundTables
      });
    }

    process.exit(allTablesExist ? 0 : 1);
  } catch (error) {
    logger.error('Database verification failed', { error });
    process.exit(1);
  }
}

verifyDatabase();
