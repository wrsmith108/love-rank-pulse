/**
 * Mock Redis Client for testing
 * Provides in-memory Redis mock with common operations
 */

export class MockRedisClient {
  private store: Map<string, { value: string; expiry?: number }> = new Map();
  private pubsubChannels: Map<string, Set<Function>> = new Map();

  // Basic operations
  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check expiry
    if (entry.expiry && entry.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, options?: { EX?: number }): Promise<string> {
    const expiry = options?.EX ? Date.now() + (options.EX * 1000) : undefined;
    this.store.set(key, { value, expiry });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    return this.set(key, value, { EX: seconds });
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;

    // Check expiry
    if (entry.expiry && entry.expiry < Date.now()) {
      this.store.delete(key);
      return 0;
    }

    return 1;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;

    entry.expiry = Date.now() + (seconds * 1000);
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (!entry.expiry) return -1;

    const remaining = Math.ceil((entry.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    const entry = this.store.get(key);
    const list = entry ? JSON.parse(entry.value) : [];
    list.unshift(...values);
    this.store.set(key, { value: JSON.stringify(list) });
    return list.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    const entry = this.store.get(key);
    const list = entry ? JSON.parse(entry.value) : [];
    list.push(...values);
    this.store.set(key, { value: JSON.stringify(list) });
    return list.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const entry = this.store.get(key);
    if (!entry) return [];

    const list = JSON.parse(entry.value);
    const actualStop = stop === -1 ? list.length : stop + 1;
    return list.slice(start, actualStop);
  }

  async llen(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;

    const list = JSON.parse(entry.value);
    return list.length;
  }

  // Hash operations
  async hset(key: string, field: string, value: string): Promise<number> {
    const entry = this.store.get(key);
    const hash = entry ? JSON.parse(entry.value) : {};
    const isNew = !hash[field];
    hash[field] = value;
    this.store.set(key, { value: JSON.stringify(hash) });
    return isNew ? 1 : 0;
  }

  async hget(key: string, field: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    const hash = JSON.parse(entry.value);
    return hash[field] || null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const entry = this.store.get(key);
    if (!entry) return {};

    return JSON.parse(entry.value);
  }

  async hdel(key: string, field: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;

    const hash = JSON.parse(entry.value);
    if (!hash[field]) return 0;

    delete hash[field];
    this.store.set(key, { value: JSON.stringify(hash) });
    return 1;
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    const entry = this.store.get(key);
    const set = new Set(entry ? JSON.parse(entry.value) : []);
    const initialSize = set.size;
    members.forEach(m => set.add(m));
    this.store.set(key, { value: JSON.stringify([...set]) });
    return set.size - initialSize;
  }

  async smembers(key: string): Promise<string[]> {
    const entry = this.store.get(key);
    if (!entry) return [];
    return JSON.parse(entry.value);
  }

  async sismember(key: string, member: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;

    const set = new Set(JSON.parse(entry.value));
    return set.has(member) ? 1 : 0;
  }

  // Sorted set operations
  async zadd(key: string, score: number, member: string): Promise<number> {
    const entry = this.store.get(key);
    const zset = entry ? JSON.parse(entry.value) : [];
    const existing = zset.findIndex((item: any) => item.member === member);

    if (existing >= 0) {
      zset[existing].score = score;
      this.store.set(key, { value: JSON.stringify(zset) });
      return 0;
    }

    zset.push({ score, member });
    this.store.set(key, { value: JSON.stringify(zset) });
    return 1;
  }

  async zrange(key: string, start: number, stop: number, options?: { withScores: boolean }): Promise<string[]> {
    const entry = this.store.get(key);
    if (!entry) return [];

    const zset = JSON.parse(entry.value);
    zset.sort((a: any, b: any) => a.score - b.score);

    const actualStop = stop === -1 ? zset.length : stop + 1;
    const slice = zset.slice(start, actualStop);

    if (options?.withScores) {
      return slice.flatMap((item: any) => [item.member, item.score.toString()]);
    }

    return slice.map((item: any) => item.member);
  }

  async zrevrange(key: string, start: number, stop: number, options?: { withScores: boolean }): Promise<string[]> {
    const entry = this.store.get(key);
    if (!entry) return [];

    const zset = JSON.parse(entry.value);
    zset.sort((a: any, b: any) => b.score - a.score);

    const actualStop = stop === -1 ? zset.length : stop + 1;
    const slice = zset.slice(start, actualStop);

    if (options?.withScores) {
      return slice.flatMap((item: any) => [item.member, item.score.toString()]);
    }

    return slice.map((item: any) => item.member);
  }

  async zrank(key: string, member: string): Promise<number | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    const zset = JSON.parse(entry.value);
    zset.sort((a: any, b: any) => a.score - b.score);

    const index = zset.findIndex((item: any) => item.member === member);
    return index >= 0 ? index : null;
  }

  // Pub/Sub operations
  async publish(channel: string, message: string): Promise<number> {
    const subscribers = this.pubsubChannels.get(channel);
    if (!subscribers) return 0;

    subscribers.forEach(callback => callback(message));
    return subscribers.size;
  }

  async subscribe(channel: string, callback: Function): Promise<void> {
    if (!this.pubsubChannels.has(channel)) {
      this.pubsubChannels.set(channel, new Set());
    }
    this.pubsubChannels.get(channel)!.add(callback);
  }

  // Utility methods
  async flushall(): Promise<string> {
    this.store.clear();
    this.pubsubChannels.clear();
    return 'OK';
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  // Disconnect (no-op for mock)
  async disconnect(): Promise<void> {
    // No-op
  }

  async quit(): Promise<void> {
    this.store.clear();
    this.pubsubChannels.clear();
  }
}

export const createMockRedisClient = (): MockRedisClient => {
  return new MockRedisClient();
};

let mockRedis: MockRedisClient;

export const getMockRedisClient = (): MockRedisClient => {
  if (!mockRedis) {
    mockRedis = new MockRedisClient();
  }
  return mockRedis;
};

export const resetMockRedis = async (): Promise<void> => {
  if (mockRedis) {
    await mockRedis.flushall();
  }
};

export default getMockRedisClient;
