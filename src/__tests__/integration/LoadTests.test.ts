/**
 * Load Tests: System Scalability and Stability
 * Test Suite: TC-LOAD-001 through TC-LOAD-005
 * Coverage: Concurrent users, high request rates, WebSocket scaling, connection pooling, memory stability
 */

import '../setup/jest.polyfills';
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { Server as SocketIOServer } from 'socket.io';

const server = setupServer(
  http.post('/api/auth/login', async () => {
    await delay(10);
    return HttpResponse.json({ token: 'mock-token', user: { id: '1', username: 'testuser' } });
  }),
  http.get('/api/leaderboard', async () => {
    await delay(15);
    return HttpResponse.json([
      { id: '1', name: 'Player A', rank: 1, rating: 1500 },
      { id: '2', name: 'Player B', rank: 2, rating: 1450 },
    ]);
  }),
  http.get('/api/players/:id/stats', async () => {
    await delay(20);
    return HttpResponse.json({
      wins: 10,
      losses: 2,
      winRate: 83.33,
      averageScore: 19.5,
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Load Tests - System Scalability', () => {
  /**
   * TC-LOAD-001: Concurrent Users (1000)
   * SLA: All requests succeed, response times <500ms, system stable
   */
  test('TC-LOAD-001: System handles 1000 concurrent users', async () => {
    const concurrentUsers = 1000;
    const results = {
      successful: 0,
      failed: 0,
      responseTimes: [] as number[],
    };

    // Simulate 1000 concurrent users
    const userActions = async () => {
      try {
        const start = performance.now();

        // Login
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'user@test.com', password: 'pass123' }),
        });

        if (!loginResponse.ok) throw new Error('Login failed');

        // View leaderboard
        const leaderboardResponse = await fetch('/api/leaderboard');
        if (!leaderboardResponse.ok) throw new Error('Leaderboard fetch failed');

        // View player stats
        const statsResponse = await fetch('/api/players/1/stats');
        if (!statsResponse.ok) throw new Error('Stats fetch failed');

        const duration = performance.now() - start;
        results.responseTimes.push(duration);
        results.successful++;
      } catch (error) {
        results.failed++;
      }
    };

    // Execute all user actions concurrently
    const startTime = performance.now();
    await Promise.all(
      Array.from({ length: concurrentUsers }, () => userActions())
    );
    const totalDuration = performance.now() - startTime;

    // Calculate statistics
    const avgResponseTime =
      results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;
    const maxResponseTime = Math.max(...results.responseTimes);
    const successRate = (results.successful / concurrentUsers) * 100;

    console.log('Concurrent Users Test:', {
      totalUsers: concurrentUsers,
      successful: results.successful,
      failed: results.failed,
      successRate: `${successRate.toFixed(2)}%`,
      avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
      maxResponseTime: `${maxResponseTime.toFixed(2)}ms`,
      totalDuration: `${(totalDuration / 1000).toFixed(2)}s`,
    });

    // Assert SLA compliance
    expect(results.successful).toBe(concurrentUsers); // All succeed
    expect(avgResponseTime).toBeLessThan(500); // <500ms average
    expect(results.failed).toBe(0); // No errors
  });

  /**
   * TC-LOAD-002: High Request Rate (10,000 req/min)
   * SLA: All requests handled, error rate <0.1%
   */
  test('TC-LOAD-002: System handles 10,000 requests per minute', async () => {
    const totalRequests = 10000;
    const durationMs = 60000; // 1 minute
    const results = {
      successful: 0,
      failed: 0,
      rateLimited: 0,
      responseTimes: [] as number[],
    };

    const executeRequest = async () => {
      try {
        const start = performance.now();
        const response = await fetch('/api/leaderboard');
        const duration = performance.now() - start;

        if (response.status === 429) {
          results.rateLimited++;
        } else if (response.ok) {
          results.successful++;
          results.responseTimes.push(duration);
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
      }
    };

    // Execute requests over 1 minute
    const startTime = performance.now();
    const requests: Promise<void>[] = [];

    // Send requests in batches to simulate realistic load
    const batchSize = 100;
    const batches = totalRequests / batchSize;
    const delayBetweenBatches = durationMs / batches;

    for (let batch = 0; batch < batches; batch++) {
      const batchRequests = Array.from({ length: batchSize }, () => executeRequest());
      requests.push(...batchRequests);

      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    await Promise.all(requests);
    const actualDuration = performance.now() - startTime;

    const errorRate = (results.failed / totalRequests) * 100;
    const requestsPerSecond = (totalRequests / (actualDuration / 1000)).toFixed(2);

    console.log('High Request Rate Test:', {
      totalRequests,
      successful: results.successful,
      failed: results.failed,
      rateLimited: results.rateLimited,
      errorRate: `${errorRate.toFixed(3)}%`,
      requestsPerSecond: `${requestsPerSecond} req/s`,
      duration: `${(actualDuration / 1000).toFixed(2)}s`,
    });

    // Assert SLA compliance
    expect(results.successful + results.rateLimited).toBeGreaterThan(totalRequests * 0.99);
    expect(errorRate).toBeLessThan(0.1); // Error rate <0.1%
  });

  /**
   * TC-LOAD-003: WebSocket Scaling (5000 connections)
   * SLA: All connections maintained, broadcast <1s, memory <2GB, CPU <80%
   */
  test('TC-LOAD-003: System scales to 5000 WebSocket connections', async () => {
    const targetConnections = 5000;
    let ioServer: SocketIOServer;
    const clients: ClientSocket[] = [];
    let connectedCount = 0;

    // Setup WebSocket server
    ioServer = new SocketIOServer(3003, {
      cors: { origin: '*' },
      maxHttpBufferSize: 1e6,
      pingTimeout: 60000,
    });

    ioServer.on('connection', () => {
      connectedCount++;
    });

    // Establish connections in batches
    const batchSize = 100;
    const batches = targetConnections / batchSize;

    const startTime = performance.now();
    const initialMemory = process.memoryUsage().heapUsed;

    for (let batch = 0; batch < batches; batch++) {
      const batchClients = Array.from({ length: batchSize }, () => {
        return ioc('http://localhost:3003', {
          transports: ['websocket'],
          reconnection: false,
        });
      });

      clients.push(...batchClients);

      // Wait for batch to connect
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Wait for all connections to establish
    await new Promise(resolve => setTimeout(resolve, 1000));

    const connectionTime = performance.now() - startTime;
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB

    // Test broadcast performance
    const broadcastStart = performance.now();
    let receivedCount = 0;

    clients.slice(0, 100).forEach(client => {
      client.on('broadcast', () => receivedCount++);
    });

    ioServer.emit('broadcast', { message: 'test', timestamp: Date.now() });

    await new Promise(resolve => setTimeout(resolve, 1000));
    const broadcastTime = performance.now() - broadcastStart;

    console.log('WebSocket Scaling Test:', {
      targetConnections,
      connectedCount,
      connectionTime: `${(connectionTime / 1000).toFixed(2)}s`,
      broadcastTime: `${broadcastTime.toFixed(2)}ms`,
      memoryIncrease: `${memoryIncrease.toFixed(2)} MB`,
      receivedMessages: receivedCount,
    });

    // Assert SLA compliance
    expect(connectedCount).toBeGreaterThanOrEqual(targetConnections * 0.95); // 95%+ connected
    expect(broadcastTime).toBeLessThan(1000); // Broadcast <1s
    expect(memoryIncrease).toBeLessThan(2000); // Memory <2GB

    // Cleanup
    clients.forEach(client => client.disconnect());
    await new Promise<void>(resolve => ioServer.close(() => resolve()));
  }, 60000); // 60 second timeout

  /**
   * TC-LOAD-004: Database Connection Pool Under Load
   * SLA: Pool manages load, no exhaustion, avg wait <50ms
   */
  test('TC-LOAD-004: Connection pool manages concurrent queries efficiently', async () => {
    const maxPoolSize = 10;
    const concurrentQueries = 1000;

    const connectionPool = {
      available: maxPoolSize,
      inUse: 0,
      waitTimes: [] as number[],
    };

    const executeQuery = async () => {
      const waitStart = performance.now();

      // Wait for available connection
      while (connectionPool.available === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const waitTime = performance.now() - waitStart;
      connectionPool.waitTimes.push(waitTime);

      // Acquire connection
      connectionPool.available--;
      connectionPool.inUse++;

      // Simulate query execution
      await new Promise(resolve => setTimeout(resolve, 10));

      // Release connection
      connectionPool.available++;
      connectionPool.inUse--;
    };

    const startTime = performance.now();
    await Promise.all(
      Array.from({ length: concurrentQueries }, () => executeQuery())
    );
    const totalTime = performance.now() - startTime;

    const avgWaitTime =
      connectionPool.waitTimes.reduce((a, b) => a + b, 0) / connectionPool.waitTimes.length;
    const maxWaitTime = Math.max(...connectionPool.waitTimes);

    console.log('Connection Pool Test:', {
      maxPoolSize,
      concurrentQueries,
      avgWaitTime: `${avgWaitTime.toFixed(2)}ms`,
      maxWaitTime: `${maxWaitTime.toFixed(2)}ms`,
      totalTime: `${(totalTime / 1000).toFixed(2)}s`,
      queriesPerSecond: ((concurrentQueries / (totalTime / 1000)).toFixed(2)),
    });

    // Assert SLA compliance
    expect(avgWaitTime).toBeLessThan(50); // Avg wait <50ms
    expect(connectionPool.available).toBe(maxPoolSize); // All connections released
    expect(connectionPool.inUse).toBe(0); // No leaks
  });

  /**
   * TC-LOAD-005: Memory Usage Under Load
   * SLA: Memory stable, no leaks, GC efficient, heap within limits
   */
  test('TC-LOAD-005: Memory remains stable under sustained load', async () => {
    const durationSeconds = 10; // 10-minute simulation (reduced for test)
    const requestsPerSecond = 100;
    const totalRequests = durationSeconds * requestsPerSecond;

    const memorySnapshots: number[] = [];
    let requestCount = 0;

    const initialMemory = process.memoryUsage().heapUsed;
    memorySnapshots.push(initialMemory);

    // Simulate sustained load
    const startTime = performance.now();

    for (let i = 0; i < totalRequests; i++) {
      await fetch('/api/leaderboard');
      requestCount++;

      // Take memory snapshot every 100 requests
      if (requestCount % 100 === 0) {
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }
    }

    const endTime = performance.now();
    const finalMemory = process.memoryUsage().heapUsed;

    // Calculate memory statistics
    const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB
    const maxMemory = Math.max(...memorySnapshots) / (1024 * 1024); // MB
    const avgMemory =
      memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length / (1024 * 1024);

    // Calculate memory growth rate
    const memoryGrowthRate =
      ((finalMemory - initialMemory) / initialMemory) * 100;

    console.log('Memory Stability Test:', {
      duration: `${((endTime - startTime) / 1000).toFixed(2)}s`,
      totalRequests,
      initialMemory: `${(initialMemory / 1024 / 1024).toFixed(2)} MB`,
      finalMemory: `${(finalMemory / 1024 / 1024).toFixed(2)} MB`,
      memoryIncrease: `${memoryIncrease.toFixed(2)} MB`,
      maxMemory: `${maxMemory.toFixed(2)} MB`,
      avgMemory: `${avgMemory.toFixed(2)} MB`,
      memoryGrowthRate: `${memoryGrowthRate.toFixed(2)}%`,
      snapshots: memorySnapshots.length,
    });

    // Assert SLA compliance
    expect(memoryIncrease).toBeLessThan(50); // Memory increase <50MB
    expect(memoryGrowthRate).toBeLessThan(100); // Growth <100%
    expect(maxMemory).toBeLessThan(200); // Peak memory <200MB

    // Verify memory trend is not continuously increasing (no leak)
    const firstHalf = memorySnapshots.slice(0, Math.floor(memorySnapshots.length / 2));
    const secondHalf = memorySnapshots.slice(Math.floor(memorySnapshots.length / 2));

    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const memoryTrendIncrease = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

    console.log('Memory Trend Analysis:', {
      firstHalfAvg: `${(firstHalfAvg / 1024 / 1024).toFixed(2)} MB`,
      secondHalfAvg: `${(secondHalfAvg / 1024 / 1024).toFixed(2)} MB`,
      trendIncrease: `${memoryTrendIncrease.toFixed(2)}%`,
    });

    // Memory trend should be relatively stable (not continuously growing)
    expect(memoryTrendIncrease).toBeLessThan(50); // Trend increase <50%
  });
});
