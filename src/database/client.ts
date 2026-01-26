import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';

class DatabaseClient {
  private pool: Pool | null = null;
  private redis: Redis | null = null;

  async connect() {
    // PostgreSQL connection
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test the connection
    const client = await this.pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    console.log('PostgreSQL connected');

    // Redis connection (optional)
    if (process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
        });

        this.redis.on('error', (err) => {
          console.error('Redis error:', err);
        });

        console.log('Redis connected');
      } catch (error) {
        console.warn('Redis connection failed (optional):', error);
      }
    } else {
      console.log('Redis not configured (optional)');
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    if (this.redis) {
      this.redis.disconnect();
      this.redis = null;
    }
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool;
  }

  getRedis(): Redis {
    if (!this.redis) {
      throw new Error('Redis not connected');
    }
    return this.redis;
  }

  async query(text: string, params?: any[]) {
    const pool = this.getPool();
    return pool.query(text, params);
  }

  async getClient(): Promise<PoolClient> {
    const pool = this.getPool();
    return pool.connect();
  }
}

export const Database = new DatabaseClient();
