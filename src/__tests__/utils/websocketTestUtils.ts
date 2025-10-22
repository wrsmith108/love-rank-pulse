import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer, createServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { AddressInfo } from 'net';
import jwt, { Secret } from 'jsonwebtoken';

export interface TestServerSetup {
  io: SocketIOServer;
  httpServer: HTTPServer;
  port: number;
  cleanup: () => Promise<void>;
}

export interface TestClient {
  socket: ClientSocket;
  disconnect: () => void;
}

/**
 * Create a test Socket.IO server
 */
export async function createTestServer(): Promise<TestServerSetup> {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });

  const address = httpServer.address() as AddressInfo;
  const port = address.port;

  const cleanup = async () => {
    await new Promise<void>((resolve) => {
      io.close(() => {
        httpServer.close(() => resolve());
      });
    });
  };

  return { io, httpServer, port, cleanup };
}

/**
 * Create a test client connected to server
 */
export function createTestClient(port: number, auth?: { token?: string }): TestClient {
  const socket = ioClient(`http://localhost:${port}`, {
    auth: auth || {},
    transports: ['websocket'],
    reconnection: false,
  });

  const disconnect = () => {
    socket.disconnect();
  };

  return { socket, disconnect };
}

/**
 * Wait for socket event with timeout
 */
export function waitForEvent<T = any>(
  socket: ClientSocket,
  event: string,
  timeout: number = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Wait for multiple socket events
 */
export function waitForEvents(
  socket: ClientSocket,
  events: string[],
  timeout: number = 5000
): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for events: ${events.join(', ')}`));
    }, timeout);

    const results: Record<string, any> = {};
    let receivedCount = 0;

    events.forEach((event) => {
      socket.once(event, (data: any) => {
        results[event] = data;
        receivedCount++;

        if (receivedCount === events.length) {
          clearTimeout(timer);
          resolve(results);
        }
      });
    });
  });
}

/**
 * Generate test JWT token
 */
export function generateTestToken(
  userId: string,
  expiresIn: number | string = '1h'
): string {
  const secret: Secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign({ userId }, secret, { expiresIn: expiresIn as any });
}

/**
 * Generate expired JWT token
 */
export function generateExpiredToken(userId: string): string {
  const secret: Secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign({ userId }, secret, { expiresIn: '-1h' as any });
}

/**
 * Mock Redis client for testing
 */
export function createMockRedisClient() {
  const subscribers = new Map<string, Set<Function>>();
  const data = new Map<string, string>();

  return {
    subscribe: jest.fn((channel: string) => Promise.resolve()),
    unsubscribe: jest.fn((channel: string) => Promise.resolve()),
    publish: jest.fn((channel: string, message: string) => {
      const subs = subscribers.get(channel);
      if (subs) {
        subs.forEach((callback) => callback(message, channel));
      }
      return Promise.resolve(1);
    }),
    on: jest.fn((event: string, callback: Function) => {
      if (event === 'message') {
        // Store message handlers
        subscribers.set('*', subscribers.get('*') || new Set());
        subscribers.get('*')!.add(callback);
      }
    }),
    get: jest.fn((key: string) => Promise.resolve(data.get(key) || null)),
    set: jest.fn((key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve('OK');
    }),
    del: jest.fn((key: string) => {
      const existed = data.has(key);
      data.delete(key);
      return Promise.resolve(existed ? 1 : 0);
    }),
    quit: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(),
    duplicate: jest.fn(function () {
      return createMockRedisClient();
    }),
    // Helper to simulate receiving a message
    _simulateMessage: (channel: string, message: string) => {
      const subs = subscribers.get('*');
      if (subs) {
        subs.forEach((callback) => callback(message, channel));
      }
    },
  };
}

/**
 * Wait for condition to be true
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Create multiple test clients
 */
export function createMultipleClients(
  port: number,
  count: number,
  authTokens?: string[]
): TestClient[] {
  const clients: TestClient[] = [];

  for (let i = 0; i < count; i++) {
    const auth = authTokens && authTokens[i]
      ? { token: authTokens[i] }
      : undefined;
    clients.push(createTestClient(port, auth));
  }

  return clients;
}

/**
 * Disconnect all clients
 */
export function disconnectAllClients(clients: TestClient[]): void {
  clients.forEach((client) => client.disconnect());
}

/**
 * Measure event latency
 */
export async function measureEventLatency(
  socket: ClientSocket,
  emitEvent: string,
  responseEvent: string,
  data?: any
): Promise<number> {
  const startTime = Date.now();

  const responsePromise = waitForEvent(socket, responseEvent);
  socket.emit(emitEvent, data);
  await responsePromise;

  return Date.now() - startTime;
}

/**
 * Create test leaderboard data
 */
export function createTestLeaderboardData(count: number = 10) {
  return Array.from({ length: count }, (_, i) => ({
    playerId: `player-${i + 1}`,
    username: `Player${i + 1}`,
    rating: 1500 - i * 50,
    rank: i + 1,
    wins: 10 - i,
    losses: i,
    winRate: ((10 - i) / 10) * 100,
  }));
}

/**
 * Create test match data
 */
export function createTestMatchData(
  player1Id: string,
  player2Id: string,
  winner?: string
) {
  return {
    id: `match-${Date.now()}`,
    player1Id,
    player2Id,
    player1Score: winner === player1Id ? 1 : 0,
    player2Score: winner === player2Id ? 1 : 0,
    status: winner ? 'COMPLETED' : 'IN_PROGRESS',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Assert event was emitted with data
 */
export function expectEventEmitted(
  socket: ClientSocket,
  event: string,
  timeout: number = 1000
): Promise<any> {
  return waitForEvent(socket, event, timeout);
}

/**
 * Assert event was NOT emitted
 */
export async function expectEventNotEmitted(
  socket: ClientSocket,
  event: string,
  waitTime: number = 1000
): Promise<void> {
  let eventReceived = false;

  socket.once(event, () => {
    eventReceived = true;
  });

  await new Promise((resolve) => setTimeout(resolve, waitTime));

  if (eventReceived) {
    throw new Error(`Event ${event} was unexpectedly emitted`);
  }
}
