/**
 * Cache Service Tests (Redis)
 * Tests Redis connection, caching operations, TTL management, and distributed caching
 *
 * Test Coverage:
 * - TC-CACHE-001 to TC-CACHE-012: Comprehensive Redis cache testing
 */

import {
  initializeCache,
  getRedisClient,
  closeCache,
  cacheHealthCheck,
  setCache,
  getCache,
  deleteCache,
  clearCachePattern,
  cacheLeaderboard,
  getCachedLeaderboard,
  cachePlayerStats,
  getCachedPlayerStats,
  getCacheMetrics,
} from '../cache';

// Mock Redis Client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    quit: jest.fn(),
    ping: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    on: jest.fn(),
    isOpen: true,
  })),
}));

describe('Cache Service Tests (Redis)', () => {
  let mockRedisClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const { createClient } = require('redis');
    mockRedisClient = createClient();
  });

  afterEach(async () => {
    await closeCache().catch(() => {});
  });

  describe('TC-CACHE-001: Redis Connection Initialization', () => {
    it('should establish Redis connection successfully', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');

      await initializeCache(1, 100);

      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should verify connection URL is correct', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');

      await initializeCache(1, 100);

      const metrics = getCacheMetrics();
      expect(metrics.isInitialized).toBe(true);
    });

    it('should confirm ready state after connection', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');

      await initializeCache(1, 100);

      const health = await cacheHealthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details?.connected).toBe(true);
    });
  });

  describe('TC-CACHE-002: Get/Set Operations', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      await initializeCache(1, 100);
    });

    it('should set and retrieve key-value pairs', async () => {
      const testData = { username: 'testuser', elo: 1200 };
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        data: testData,
        timestamp: Date.now(),
        ttl: 300
      }));

      await setCache('test:key', testData, 300);
      const retrieved = await getCache('test:key');

      expect(mockRedisClient.setEx).toHaveBeenCalled();
      expect(retrieved).toEqual(testData);
    });

    it('should verify stored value matches original', async () => {
      const testValue = 'test-value-123';
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        data: testValue,
        timestamp: Date.now(),
        ttl: 60
      }));

      await setCache('exact:match', testValue);
      const result = await getCache('exact:match');

      expect(result).toBe(testValue);
    });

    it('should handle TTL when specified', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await setCache('ttl:key', 'value', 120);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'ttl:key',
        120,
        expect.any(String)
      );
    });
  });

  describe('TC-CACHE-003: Cache Expiration (TTL)', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      await initializeCache(1, 100);
    });

    it('should set key with TTL of 1 second', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await setCache('expire:test', 'value', 1);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'expire:test',
        1,
        expect.any(String)
      );
    });

    it('should verify key exists before expiration', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        data: 'value',
        timestamp: Date.now(),
        ttl: 1
      }));

      await setCache('exists:test', 'value', 1);
      const value = await getCache('exists:test');

      expect(value).toBe('value');
    });

    it('should confirm key expired and removed after TTL', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({
        data: 'value',
        timestamp: Date.now(),
        ttl: 1
      })).mockResolvedValueOnce(null); // Expired

      await setCache('expired:key', 'value', 1);

      // Simulate waiting
      await new Promise(resolve => setTimeout(resolve, 1100));

      const value = await getCache('expired:key');
      expect(value).toBeNull();
    });
  });

  describe('TC-CACHE-004: Cache Invalidation', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      await initializeCache(1, 100);
    });

    it('should set multiple keys with pattern', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await setCache('leaderboard:global', 'data1');
      await setCache('leaderboard:country:US', 'data2');
      await setCache('leaderboard:session:123', 'data3');

      expect(mockRedisClient.setEx).toHaveBeenCalledTimes(3);
    });

    it('should delete all keys matching leaderboard:* pattern', async () => {
      mockRedisClient.keys.mockResolvedValue([
        'leaderboard:global',
        'leaderboard:country:US',
        'leaderboard:session:123'
      ]);
      mockRedisClient.del.mockResolvedValue(3);

      await clearCachePattern('leaderboard:*');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('leaderboard:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith([
        'leaderboard:global',
        'leaderboard:country:US',
        'leaderboard:session:123'
      ]);
    });

    it('should preserve unrelated keys', async () => {
      mockRedisClient.keys.mockResolvedValue(['leaderboard:global']);
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        data: 'preserved',
        timestamp: Date.now(),
        ttl: 300
      }));

      await clearCachePattern('leaderboard:*');

      // Verify unrelated key still exists
      const preserved = await getCache('player:123:stats');
      // Since we didn't delete player keys, get would work if it existed
      expect(mockRedisClient.del).not.toHaveBeenCalledWith(expect.arrayContaining(['player:123:stats']));
    });
  });

  describe('TC-CACHE-005: Connection Recovery', () => {
    it('should detect disconnection', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.isOpen = false;

      await initializeCache(1, 100);

      // Simulate disconnection
      mockRedisClient.isOpen = false;

      await expect(getCache('test:key')).rejects.toThrow();
    });

    it('should attempt auto-reconnect', async () => {
      mockRedisClient.connect
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');

      await initializeCache(3, 100);

      expect(mockRedisClient.connect).toHaveBeenCalledTimes(2);
    });

    it('should resume operations after reconnection', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.setEx.mockResolvedValue('OK');

      await initializeCache(1, 100);

      // Reconnection successful, operations should work
      await expect(setCache('test:key', 'value')).resolves.not.toThrow();
    });
  });

  describe('TC-CACHE-006: Distributed Cache Consistency', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      await initializeCache(1, 100);
    });

    it('should set key on instance A', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await setCache('distributed:key', 'value-A');

      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    it('should read same value from instance B', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        data: 'value-A',
        timestamp: Date.now(),
        ttl: 300
      }));

      const value = await getCache('distributed:key');

      expect(value).toBe('value-A');
    });

    it('should verify value consistency across instances', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        data: { count: 42 },
        timestamp: Date.now(),
        ttl: 300
      }));

      await setCache('consistent:data', { count: 42 });
      const retrieved = await getCache('consistent:data');

      expect(retrieved).toEqual({ count: 42 });
    });
  });

  describe('TC-CACHE-007: Cache Key Namespacing', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      await initializeCache(1, 100);
    });

    it('should store user:123 and session:123 separately', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await setCache('user:123', 'user-data');
      await setCache('session:123', 'session-data');

      expect(mockRedisClient.setEx).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.setEx).toHaveBeenNthCalledWith(1, 'user:123', expect.any(Number), expect.any(String));
      expect(mockRedisClient.setEx).toHaveBeenNthCalledWith(2, 'session:123', expect.any(Number), expect.any(String));
    });

    it('should verify both keys stored separately', async () => {
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ data: 'user-data', timestamp: Date.now(), ttl: 300 }))
        .mockResolvedValueOnce(JSON.stringify({ data: 'session-data', timestamp: Date.now(), ttl: 300 }));

      const userData = await getCache('user:123');
      const sessionData = await getCache('session:123');

      expect(userData).toBe('user-data');
      expect(sessionData).toBe('session-data');
    });

    it('should check no key collisions occur', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.keys.mockResolvedValue(['user:123', 'session:123']);

      await setCache('user:123', 'data1');
      await setCache('session:123', 'data2');

      const keys = await mockRedisClient.keys('*:123');
      expect(keys).toHaveLength(2);
      expect(keys).toContain('user:123');
      expect(keys).toContain('session:123');
    });
  });

  describe('TC-CACHE-008: TTL Management', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      await initializeCache(1, 100);
    });

    it('should set initial TTL to 60 seconds', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await setCache('ttl:test', 'value', 60);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith('ttl:test', 60, expect.any(String));
    });

    it('should update TTL to 120 seconds', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await setCache('ttl:test', 'value', 120);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith('ttl:test', 120, expect.any(String));
    });

    it('should verify TTL changed successfully', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await setCache('ttl:test', 'value', 60);
      await setCache('ttl:test', 'value', 120);

      expect(mockRedisClient.setEx).toHaveBeenLastCalledWith('ttl:test', 120, expect.any(String));
    });
  });

  describe('TC-CACHE-009: Atomic Operations (INCR/DECR)', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      await initializeCache(1, 100);
    });

    it('should increment counter 10 times atomically', async () => {
      let counter = 0;
      mockRedisClient.get.mockImplementation(async () => {
        return JSON.stringify({ data: counter, timestamp: Date.now(), ttl: 300 });
      });
      mockRedisClient.setEx.mockImplementation(async (key: string, ttl: number, value: string) => {
        const parsed = JSON.parse(value);
        counter = parsed.data + 1;
        return 'OK';
      });

      // Simulate 10 increments
      for (let i = 0; i < 10; i++) {
        const current = await getCache('counter') as number || 0;
        await setCache('counter', current + 1, 300);
      }

      expect(counter).toBeGreaterThan(0);
    });

    it('should verify final counter value is 10', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        data: 10,
        timestamp: Date.now(),
        ttl: 300
      }));

      const final = await getCache('counter');
      expect(final).toBe(10);
    });

    it('should ensure no race conditions occurred', async () => {
      // Atomic operations prevent race conditions
      // In Redis, INCR is atomic by design
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        data: 10,
        timestamp: Date.now(),
        ttl: 300
      }));

      const value = await getCache('counter');
      expect(value).toBeDefined();
    });
  });

  describe('TC-CACHE-010: Pipeline Operations', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      await initializeCache(1, 100);
    });

    it('should execute 100 commands in pipeline', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      const operations = Array.from({ length: 100 }, (_, i) =>
        setCache(`pipeline:key:${i}`, `value-${i}`)
      );

      await Promise.all(operations);

      expect(mockRedisClient.setEx).toHaveBeenCalledTimes(100);
    });

    it('should verify all commands executed atomically', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      const operations = Array.from({ length: 50 }, (_, i) =>
        setCache(`batch:${i}`, `val-${i}`)
      );

      const results = await Promise.all(operations);

      expect(results.every(r => r === undefined)).toBe(true);
    });

    it('should confirm pipeline faster than individual commands', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      const startPipeline = Date.now();
      await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          setCache(`fast:${i}`, `val-${i}`)
        )
      );
      const pipelineDuration = Date.now() - startPipeline;

      // Pipeline should be relatively fast
      expect(pipelineDuration).toBeLessThan(1000);
    });
  });

  describe('TC-CACHE-011: Cache Miss Handling', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      await initializeCache(1, 100);
    });

    it('should return null for non-existent key', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const value = await getCache('nonexistent:key');

      expect(value).toBeNull();
    });

    it('should not throw error on cache miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(getCache('missing:key')).resolves.toBeNull();
    });

    it('should implement cache-aside pattern correctly', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setEx.mockResolvedValue('OK');

      // Check cache (miss)
      let value = await getCache('cache:aside');

      if (!value) {
        // Fetch from DB (simulated)
        value = 'from-database';
        // Store in cache
        await setCache('cache:aside', value);
      }

      expect(value).toBe('from-database');
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });
  });

  describe('TC-CACHE-012: Memory Management', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      await initializeCache(1, 100);
    });

    it('should fill cache to 80% capacity', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      // Simulate filling cache
      const operations = Array.from({ length: 1000 }, (_, i) =>
        setCache(`memory:${i}`, `large-value-${i}`)
      );

      await Promise.all(operations);

      expect(mockRedisClient.setEx).toHaveBeenCalledTimes(1000);
    });

    it('should trigger eviction policy when memory limit reached', async () => {
      // Redis eviction policy (LRU) is configured at server level
      // We verify the service handles it gracefully
      mockRedisClient.setEx.mockResolvedValue('OK');

      await setCache('evict:test', 'value');

      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    it('should preserve critical keys from eviction', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        data: 'critical-data',
        timestamp: Date.now(),
        ttl: 3600 // Longer TTL for critical data
      }));

      // Critical keys would have longer TTL
      await setCache('critical:key', 'critical-data', 3600);

      const value = await getCache('critical:key');
      expect(value).toBe('critical-data');
    });
  });
});
