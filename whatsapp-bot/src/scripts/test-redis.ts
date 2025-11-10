/**
 * Quick Redis connection test script
 * Run this to verify Redis is working: npm run test:redis
 */

import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function testRedis() {
  try {
    console.log('🔌 Testing Redis connection...');
    
    // Test connection
    await redis.ping();
    console.log('✅ Redis connection successful!');
    
    // Test set/get
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');
    console.log(`✅ Redis set/get test: ${value}`);
    
    // Cleanup
    await redis.del('test-key');
    console.log('✅ Redis test completed successfully!');
    
    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    console.error('\nMake sure Redis is running!');
    console.error('Options:');
    console.error('1. Install Redis locally');
    console.error('2. Use Redis Cloud: https://redis.com/try-free/');
    console.error('3. Use Docker: docker run -d -p 6379:6379 redis:latest');
    process.exit(1);
  }
}

testRedis();

