import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { performance } from 'perf_hooks';
import { createTestServer, TestServerSetup } from '../utils/websocketTestUtils';

interface LoadTestMetrics {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  averageConnectionTime: number;
  minConnectionTime: number;
  maxConnectionTime: number;
  averageMessageLatency: number;
  minMessageLatency: number;
  maxMessageLatency: number;
  messagesPerSecond: number;
  memoryUsageBefore: NodeJS.MemoryUsage;
  memoryUsageAfter: NodeJS.MemoryUsage;
  memoryLeakDetected: boolean;
  connectionErrors: string[];
  duration: number;
}

interface ConnectionMetrics {
  connectionTime: number;
  success: boolean;
  error?: string;
}

interface MessageMetrics {
  latency: number;
  success: boolean;
  timestamp: number;
}

/**
 * Load testing suite for WebSocket functionality
 */
describe('WebSocket Load Testing', () => {
  let testServer: TestServerSetup;
  const TEST_TIMEOUT = 60000; // 60 seconds for load tests

  beforeEach(async () => {
    testServer = await createTestServer();

    // Setup handlers for load testing
    testServer.io.on('connection', (socket) => {
      socket.on('echo', (data, callback) => {
        callback(data);
      });

      socket.on('broadcast-test', (data) => {
        testServer.io.emit('broadcast-received', data);
      });

      socket.on('subscribe-room', (room: string) => {
        socket.join(room);
      });

      socket.on('room-message', (data: { room: string; message: any }) => {
        testServer.io.to(data.room).emit('room-broadcast', data.message);
      });
    });
  }, TEST_TIMEOUT);

  afterEach(async () => {
    await testServer.cleanup();
  }, TEST_TIMEOUT);

  /**
   * Create multiple client connections
   */
  async function createMultipleConnections(
    count: number,
    port: number
  ): Promise<{ sockets: ClientSocket[]; metrics: ConnectionMetrics[] }> {
    const sockets: ClientSocket[] = [];
    const metrics: ConnectionMetrics[] = [];

    const connectionPromises = Array.from({ length: count }, async () => {
      const startTime = performance.now();

      try {
        const socket = ioClient(`http://localhost:${port}`, {
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 5000);

          socket.on('connect', () => {
            clearTimeout(timeout);
            resolve();
          });

          socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        const connectionTime = performance.now() - startTime;
        sockets.push(socket);
        metrics.push({ connectionTime, success: true });
      } catch (error) {
        const connectionTime = performance.now() - startTime;
        metrics.push({
          connectionTime,
          success: false,
          error: (error as Error).message,
        });
      }
    });

    await Promise.all(connectionPromises);
    return { sockets, metrics };
  }

  /**
   * Disconnect all sockets
   */
  function disconnectAll(sockets: ClientSocket[]): void {
    sockets.forEach((socket) => {
      if (socket.connected) {
        socket.disconnect();
      }
    });
  }

  /**
   * Measure message latency
   */
  async function measureMessageLatency(
    socket: ClientSocket,
    messageCount: number
  ): Promise<MessageMetrics[]> {
    const metrics: MessageMetrics[] = [];

    for (let i = 0; i < messageCount; i++) {
      const startTime = performance.now();
      const message = { id: i, data: `test-${i}` };

      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Message timeout'));
          }, 1000);

          socket.emit('echo', message, (response: any) => {
            clearTimeout(timeout);
            const latency = performance.now() - startTime;
            metrics.push({
              latency,
              success: true,
              timestamp: Date.now(),
            });
            resolve();
          });
        });
      } catch (error) {
        metrics.push({
          latency: performance.now() - startTime,
          success: false,
          timestamp: Date.now(),
        });
      }
    }

    return metrics;
  }

  /**
   * Calculate test metrics
   */
  function calculateMetrics(
    connectionMetrics: ConnectionMetrics[],
    messageMetrics: MessageMetrics[],
    memoryBefore: NodeJS.MemoryUsage,
    memoryAfter: NodeJS.MemoryUsage,
    duration: number
  ): LoadTestMetrics {
    const successfulConnections = connectionMetrics.filter((m) => m.success).length;
    const failedConnections = connectionMetrics.filter((m) => !m.success).length;

    const connectionTimes = connectionMetrics
      .filter((m) => m.success)
      .map((m) => m.connectionTime);

    const latencies = messageMetrics.filter((m) => m.success).map((m) => m.latency);

    const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
    const memoryIncreasePercentage = (memoryIncrease / memoryBefore.heapUsed) * 100;

    return {
      totalConnections: connectionMetrics.length,
      successfulConnections,
      failedConnections,
      averageConnectionTime:
        connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length,
      minConnectionTime: Math.min(...connectionTimes),
      maxConnectionTime: Math.max(...connectionTimes),
      averageMessageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      minMessageLatency: Math.min(...latencies),
      maxMessageLatency: Math.max(...latencies),
      messagesPerSecond: (messageMetrics.length / duration) * 1000,
      memoryUsageBefore: memoryBefore,
      memoryUsageAfter: memoryAfter,
      memoryLeakDetected: memoryIncreasePercentage > 50, // >50% increase indicates potential leak
      connectionErrors: connectionMetrics
        .filter((m) => !m.success)
        .map((m) => m.error || 'Unknown error'),
      duration,
    };
  }

  describe('Concurrent Connections', () => {
    it(
      'should handle 100 concurrent connections',
      async () => {
        const connectionCount = 100;
        const memoryBefore = process.memoryUsage();

        const { sockets, metrics } = await createMultipleConnections(
          connectionCount,
          testServer.port
        );

        const memoryAfter = process.memoryUsage();

        const successfulConnections = metrics.filter((m) => m.success).length;

        expect(successfulConnections).toBeGreaterThanOrEqual(connectionCount * 0.95); // 95% success rate
        expect(sockets).toHaveLength(successfulConnections);

        // Verify all are connected
        const connectedCount = sockets.filter((s) => s.connected).length;
        expect(connectedCount).toBe(successfulConnections);

        // Check memory usage (should not increase dramatically)
        const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
        const memoryIncreasePerConnection = memoryIncrease / successfulConnections;

        console.log(`Memory increase per connection: ${(memoryIncreasePerConnection / 1024).toFixed(2)} KB`);
        expect(memoryIncreasePerConnection).toBeLessThan(1024 * 1024); // < 1MB per connection

        disconnectAll(sockets);
      },
      TEST_TIMEOUT
    );

    it(
      'should handle sequential connection and disconnection',
      async () => {
        const rounds = 5;
        const connectionsPerRound = 20;
        const memorySnapshots: NodeJS.MemoryUsage[] = [];

        for (let round = 0; round < rounds; round++) {
          const { sockets } = await createMultipleConnections(
            connectionsPerRound,
            testServer.port
          );

          memorySnapshots.push(process.memoryUsage());

          // Wait a bit
          await new Promise((resolve) => setTimeout(resolve, 100));

          disconnectAll(sockets);

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Memory should stabilize (last snapshot similar to first)
        const firstMemory = memorySnapshots[0].heapUsed;
        const lastMemory = memorySnapshots[memorySnapshots.length - 1].heapUsed;
        const memoryGrowth = lastMemory - firstMemory;
        const growthPercentage = (memoryGrowth / firstMemory) * 100;

        console.log(`Memory growth over ${rounds} rounds: ${growthPercentage.toFixed(2)}%`);
        expect(growthPercentage).toBeLessThan(50); // < 50% growth indicates no major leak
      },
      TEST_TIMEOUT
    );
  });

  describe('Message Latency', () => {
    it(
      'should maintain low latency under load',
      async () => {
        const { sockets } = await createMultipleConnections(10, testServer.port);

        const messagesPerClient = 100;
        const startTime = performance.now();

        const allMetrics = await Promise.all(
          sockets.map((socket) => measureMessageLatency(socket, messagesPerClient))
        );

        const duration = performance.now() - startTime;
        const flatMetrics = allMetrics.flat();

        const averageLatency =
          flatMetrics.reduce((sum, m) => sum + m.latency, 0) / flatMetrics.length;

        console.log(`Average latency: ${averageLatency.toFixed(2)}ms`);
        console.log(`Total messages: ${flatMetrics.length}`);
        console.log(`Duration: ${duration.toFixed(2)}ms`);
        console.log(`Messages/sec: ${((flatMetrics.length / duration) * 1000).toFixed(2)}`);

        expect(averageLatency).toBeLessThan(50); // < 50ms average latency
        expect(flatMetrics.every((m) => m.success)).toBe(true);

        disconnectAll(sockets);
      },
      TEST_TIMEOUT
    );

    it(
      'should handle rapid message emission',
      async () => {
        const { sockets } = await createMultipleConnections(5, testServer.port);

        const messagesPerSecond = 1000;
        const testDuration = 3000; // 3 seconds
        const messageInterval = 1000 / messagesPerSecond;

        const receivedCounts = new Array(sockets.length).fill(0);

        sockets.forEach((socket, index) => {
          socket.on('broadcast-received', () => {
            receivedCounts[index]++;
          });
        });

        const startTime = Date.now();
        let messagesSent = 0;

        const sendInterval = setInterval(() => {
          if (Date.now() - startTime >= testDuration) {
            clearInterval(sendInterval);
            return;
          }

          sockets[0].emit('broadcast-test', { id: messagesSent++, timestamp: Date.now() });
        }, messageInterval);

        await new Promise((resolve) => setTimeout(resolve, testDuration + 1000));

        const totalReceived = receivedCounts.reduce((sum, count) => sum + count, 0);
        const expectedTotal = messagesSent * sockets.length;

        console.log(`Messages sent: ${messagesSent}`);
        console.log(`Total received: ${totalReceived}`);
        console.log(`Expected total: ${expectedTotal}`);
        console.log(`Delivery rate: ${((totalReceived / expectedTotal) * 100).toFixed(2)}%`);

        expect(totalReceived).toBeGreaterThanOrEqual(expectedTotal * 0.9); // 90% delivery rate

        disconnectAll(sockets);
      },
      TEST_TIMEOUT
    );
  });

  describe('Memory Leak Detection', () => {
    it(
      'should not leak memory during normal operation',
      async () => {
        const cycles = 10;
        const connectionsPerCycle = 50;
        const messagesPerConnection = 20;

        const memoryBefore = process.memoryUsage();

        for (let cycle = 0; cycle < cycles; cycle++) {
          const { sockets } = await createMultipleConnections(
            connectionsPerCycle,
            testServer.port
          );

          // Send messages
          await Promise.all(
            sockets.map((socket) => measureMessageLatency(socket, messagesPerConnection))
          );

          disconnectAll(sockets);

          // Force cleanup
          if (global.gc) {
            global.gc();
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const memoryAfter = process.memoryUsage();
        const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
        const increasePercentage = (memoryIncrease / memoryBefore.heapUsed) * 100;

        console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Percentage increase: ${increasePercentage.toFixed(2)}%`);

        expect(increasePercentage).toBeLessThan(30); // < 30% increase after cycles
      },
      TEST_TIMEOUT
    );
  });

  describe('Connection Cleanup', () => {
    it(
      'should properly clean up disconnected clients',
      async () => {
        const { sockets } = await createMultipleConnections(50, testServer.port);

        const initialConnectedClients = await new Promise<number>((resolve) => {
          testServer.io.fetchSockets().then((s) => resolve(s.length));
        });

        expect(initialConnectedClients).toBe(sockets.length);

        // Disconnect half the clients
        const halfPoint = Math.floor(sockets.length / 2);
        sockets.slice(0, halfPoint).forEach((socket) => socket.disconnect());

        await new Promise((resolve) => setTimeout(resolve, 500));

        const remainingConnectedClients = await new Promise<number>((resolve) => {
          testServer.io.fetchSockets().then((s) => resolve(s.length));
        });

        expect(remainingConnectedClients).toBe(sockets.length - halfPoint);

        // Disconnect remaining
        disconnectAll(sockets.slice(halfPoint));

        await new Promise((resolve) => setTimeout(resolve, 500));

        const finalConnectedClients = await new Promise<number>((resolve) => {
          testServer.io.fetchSockets().then((s) => resolve(s.length));
        });

        expect(finalConnectedClients).toBe(0);
      },
      TEST_TIMEOUT
    );
  });

  describe('Comprehensive Load Test Report', () => {
    it(
      'should generate comprehensive performance metrics',
      async () => {
        const connectionCount = 100;
        const messagesPerClient = 50;

        const memoryBefore = process.memoryUsage();
        const startTime = performance.now();

        // Create connections
        const { sockets, metrics: connectionMetrics } = await createMultipleConnections(
          connectionCount,
          testServer.port
        );

        // Measure message latency
        const messageMetrics = (
          await Promise.all(
            sockets.map((socket) => measureMessageLatency(socket, messagesPerClient))
          )
        ).flat();

        const duration = performance.now() - startTime;
        const memoryAfter = process.memoryUsage();

        const metrics = calculateMetrics(
          connectionMetrics,
          messageMetrics,
          memoryBefore,
          memoryAfter,
          duration
        );

        // Log comprehensive report
        console.log('\n=== LOAD TEST REPORT ===');
        console.log(`Total Connections: ${metrics.totalConnections}`);
        console.log(`Successful: ${metrics.successfulConnections}`);
        console.log(`Failed: ${metrics.failedConnections}`);
        console.log(`\nConnection Times:`);
        console.log(`  Average: ${metrics.averageConnectionTime.toFixed(2)}ms`);
        console.log(`  Min: ${metrics.minConnectionTime.toFixed(2)}ms`);
        console.log(`  Max: ${metrics.maxConnectionTime.toFixed(2)}ms`);
        console.log(`\nMessage Latency:`);
        console.log(`  Average: ${metrics.averageMessageLatency.toFixed(2)}ms`);
        console.log(`  Min: ${metrics.minMessageLatency.toFixed(2)}ms`);
        console.log(`  Max: ${metrics.maxMessageLatency.toFixed(2)}ms`);
        console.log(`\nThroughput:`);
        console.log(`  Messages/sec: ${metrics.messagesPerSecond.toFixed(2)}`);
        console.log(`\nMemory:`);
        console.log(
          `  Before: ${(metrics.memoryUsageBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`
        );
        console.log(
          `  After: ${(metrics.memoryUsageAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`
        );
        console.log(
          `  Increase: ${((metrics.memoryUsageAfter.heapUsed - metrics.memoryUsageBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB`
        );
        console.log(`  Leak Detected: ${metrics.memoryLeakDetected ? 'YES' : 'NO'}`);
        console.log(`\nTest Duration: ${(metrics.duration / 1000).toFixed(2)}s`);
        console.log('========================\n');

        // Assertions
        expect(metrics.successfulConnections).toBeGreaterThanOrEqual(
          metrics.totalConnections * 0.95
        );
        expect(metrics.averageConnectionTime).toBeLessThan(100);
        expect(metrics.averageMessageLatency).toBeLessThan(50);
        expect(metrics.memoryLeakDetected).toBe(false);

        disconnectAll(sockets);
      },
      TEST_TIMEOUT
    );
  });
});
