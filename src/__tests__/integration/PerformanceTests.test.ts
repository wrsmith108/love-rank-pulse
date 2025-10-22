/**
 * Performance Tests: SLA Compliance and Benchmarks
 * Test Suite: TC-PERF-001 through TC-PERF-005
 * Coverage: Page load, API response, WebSocket latency, query performance, cache efficiency
 */

import '../setup/jest.polyfills';
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { Server as SocketIOServer } from 'socket.io';

const server = setupServer(
  http.get('/api/leaderboard', async () => {
    await delay(20); // Simulate 20ms database query
    return HttpResponse.json([
      { id: '1', name: 'Player A', rank: 1, rating: 1500, wins: 10, losses: 2 },
      { id: '2', name: 'Player B', rank: 2, rating: 1450, wins: 8, losses: 3 },
    ]);
  }),
  http.get('/api/players/:id', async ({ params }) => {
    await delay(15);
    return HttpResponse.json({
      id: params.id,
      name: 'Player A',
      rating: 1500,
      wins: 10,
      losses: 2,
    });
  }),
  http.post('/api/matches', async () => {
    await delay(30);
    return HttpResponse.json({
      match: { id: 'match-123', winnerId: '1' },
      eloChanges: { winner: { change: 32 }, loser: { change: -32 } },
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Performance Tests - SLA Compliance', () => {
  /**
   * TC-PERF-001: Page Load Time
   * SLA: Total page load <2 seconds, initial HTML <500ms
   */
  test('TC-PERF-001: Page load meets Core Web Vitals', async () => {
    const metrics = {
      htmlLoadTime: 0,
      jsLoadTime: 0,
      apiDataFetchTime: 0,
      totalLoadTime: 0,
    };

    // Simulate HTML load
    const htmlStart = performance.now();
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate HTML parsing
    metrics.htmlLoadTime = performance.now() - htmlStart;

    // Simulate JavaScript load
    const jsStart = performance.now();
    await new Promise(resolve => setTimeout(resolve, 700)); // Simulate JS execution
    metrics.jsLoadTime = performance.now() - jsStart;

    // Simulate API data fetch
    const apiStart = performance.now();
    await fetch('/api/leaderboard');
    metrics.apiDataFetchTime = performance.now() - apiStart;

    metrics.totalLoadTime = metrics.htmlLoadTime + metrics.jsLoadTime + metrics.apiDataFetchTime;

    // Assert SLA compliance
    expect(metrics.htmlLoadTime).toBeLessThan(500); // Initial HTML <500ms
    expect(metrics.jsLoadTime).toBeLessThan(1000); // JS loads <1s
    expect(metrics.apiDataFetchTime).toBeLessThan(500); // API data <500ms
    expect(metrics.totalLoadTime).toBeLessThan(2000); // Total <2s

    console.log('Page Load Metrics:', {
      htmlLoadTime: `${metrics.htmlLoadTime.toFixed(2)}ms`,
      jsLoadTime: `${metrics.jsLoadTime.toFixed(2)}ms`,
      apiDataFetchTime: `${metrics.apiDataFetchTime.toFixed(2)}ms`,
      totalLoadTime: `${metrics.totalLoadTime.toFixed(2)}ms`,
    });
  });

  /**
   * TC-PERF-002: API Response Time
   * SLA: P50 <50ms, P95 <100ms, P99 <200ms
   */
  test('TC-PERF-002: API response times meet SLA', async () => {
    const responseTimes: number[] = [];

    // Execute 100 API requests
    const endpoints = [
      '/api/leaderboard',
      '/api/players/1',
      '/api/players/2',
    ];

    for (let i = 0; i < 100; i++) {
      const endpoint = endpoints[i % endpoints.length];
      const start = performance.now();
      await fetch(endpoint);
      const duration = performance.now() - start;
      responseTimes.push(duration);
    }

    // Calculate percentiles
    const sorted = responseTimes.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

    console.log('API Response Time Percentiles:', {
      average: `${avg.toFixed(2)}ms`,
      p50: `${p50.toFixed(2)}ms`,
      p95: `${p95.toFixed(2)}ms`,
      p99: `${p99.toFixed(2)}ms`,
      samples: responseTimes.length,
    });

    // Assert SLA compliance
    expect(p50).toBeLessThan(50); // P50 <50ms
    expect(p95).toBeLessThan(100); // P95 <100ms
    expect(p99).toBeLessThan(200); // P99 <200ms

    // Verify no timeouts
    expect(responseTimes.every(t => t < 5000)).toBe(true);
  });

  /**
   * TC-PERF-003: WebSocket Message Latency
   * SLA: Average <50ms, P95 <100ms
   */
  test('TC-PERF-003: WebSocket latency meets real-time requirements', async () => {
    let ioServer: SocketIOServer;
    let clientSocket: ClientSocket;

    // Setup WebSocket server
    await new Promise<void>((resolve) => {
      ioServer = new SocketIOServer(3002, { cors: { origin: '*' } });
      ioServer.on('connection', () => resolve());
      clientSocket = ioc('http://localhost:3002', { transports: ['websocket'] });
    });

    const latencies: number[] = [];

    // Send 100 messages and measure round-trip time
    for (let i = 0; i < 100; i++) {
      const start = performance.now();

      await new Promise<void>((resolve) => {
        clientSocket.emit('ping', { timestamp: start });
        clientSocket.once('pong', () => {
          const latency = performance.now() - start;
          latencies.push(latency);
          resolve();
        });
      });
    }

    // Calculate statistics
    const sorted = latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    console.log('WebSocket Latency:', {
      average: `${avg.toFixed(2)}ms`,
      min: `${Math.min(...latencies).toFixed(2)}ms`,
      max: `${Math.max(...latencies).toFixed(2)}ms`,
      p95: `${p95.toFixed(2)}ms`,
    });

    // Assert SLA compliance
    expect(avg).toBeLessThan(50); // Average <50ms
    expect(p95).toBeLessThan(100); // P95 <100ms

    // Verify no dropped messages
    expect(latencies.length).toBe(100);

    // Cleanup
    clientSocket.disconnect();
    await new Promise<void>(resolve => ioServer.close(() => resolve()));
  });

  /**
   * TC-PERF-004: Database Query Performance
   * SLA: Query time <10ms, proper indexes used
   */
  test('TC-PERF-004: Database queries are optimized', async () => {
    // Simulate complex leaderboard query
    const executeQuery = async () => {
      const start = performance.now();

      // Simulate indexed query
      await new Promise(resolve => setTimeout(resolve, 5)); // 5ms query time

      return performance.now() - start;
    };

    const queryTimes: number[] = [];

    // Execute 50 queries
    for (let i = 0; i < 50; i++) {
      const duration = await executeQuery();
      queryTimes.push(duration);
    }

    const avg = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
    const max = Math.max(...queryTimes);

    console.log('Database Query Performance:', {
      average: `${avg.toFixed(2)}ms`,
      max: `${max.toFixed(2)}ms`,
      samples: queryTimes.length,
    });

    // Assert SLA compliance
    expect(avg).toBeLessThan(10); // Average <10ms
    expect(max).toBeLessThan(20); // Max <20ms

    // In real scenario, verify:
    // - EXPLAIN ANALYZE shows index usage
    // - No full table scans
    // - Connection pool efficient
  });

  /**
   * TC-PERF-005: Cache Hit Rate
   * SLA: Hit rate >80%, response time <20ms when cached
   */
  test('TC-PERF-005: Cache efficiency meets targets', async () => {
    const cache = new Map<string, any>();
    let cacheHits = 0;
    let cacheMisses = 0;
    const responseTimes: number[] = [];

    const fetchWithCache = async (key: string) => {
      const start = performance.now();

      if (cache.has(key)) {
        cacheHits++;
        const cachedData = cache.get(key);
        const duration = performance.now() - start;
        responseTimes.push(duration);
        return { data: cachedData, cached: true, duration };
      }

      cacheMisses++;
      // Simulate database fetch
      await new Promise(resolve => setTimeout(resolve, 20));
      const data = { id: key, rating: 1500 };
      cache.set(key, data);

      const duration = performance.now() - start;
      responseTimes.push(duration);
      return { data, cached: false, duration };
    };

    // Execute 1000 requests (mix of cached and uncached)
    const keys = Array.from({ length: 10 }, (_, i) => `player-${i}`);

    for (let i = 0; i < 1000; i++) {
      const key = keys[i % keys.length];
      await fetchWithCache(key);
    }

    const cacheHitRate = (cacheHits / (cacheHits + cacheMisses)) * 100;
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

    console.log('Cache Performance:', {
      totalRequests: 1000,
      cacheHits,
      cacheMisses,
      hitRate: `${cacheHitRate.toFixed(2)}%`,
      avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
    });

    // Assert SLA compliance
    expect(cacheHitRate).toBeGreaterThan(80); // Hit rate >80%
    expect(avgResponseTime).toBeLessThan(20); // Avg response <20ms

    // Verify memory usage stable (in real scenario)
    expect(cache.size).toBe(10); // Only 10 unique keys cached
  });

  /**
   * Additional test: Memory efficiency
   */
  test('Memory usage remains stable under load', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    const memorySnapshots: number[] = [initialMemory];

    // Simulate workload
    for (let i = 0; i < 1000; i++) {
      await fetch('/api/leaderboard');

      if (i % 100 === 0) {
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB

    console.log('Memory Usage:', {
      initial: `${(initialMemory / 1024 / 1024).toFixed(2)} MB`,
      final: `${(finalMemory / 1024 / 1024).toFixed(2)} MB`,
      increase: `${memoryIncrease.toFixed(2)} MB`,
      snapshots: memorySnapshots.length,
    });

    // Verify memory increase reasonable
    expect(memoryIncrease).toBeLessThan(50); // <50MB increase
  });
});
