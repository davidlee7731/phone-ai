import { readFileSync } from 'fs';
import { join } from 'path';
import { Database } from './client';

async function migrate() {
  try {
    console.log('Starting database migration...');

    await Database.connect();

    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await Database.query(schema);

    console.log('Migration completed successfully!');

    await Database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await Database.disconnect();
    process.exit(1);
  }
}

migrate();
