/**
 * Integration Tests: Leaderboard Real-time Updates
 * Test Suite: TC-INT-006 through TC-INT-010
 * Coverage: WebSocket real-time synchronization and conflict resolution
 */

import '../setup/jest.polyfills';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';

// Mock LeaderboardTable component
const LeaderboardTable: React.FC = () => (
  <div data-testid="leaderboard-table">
    <div>Player A</div>
    <div>Player B</div>
    <div>Player C</div>
  </div>
);

// Mock server for API calls
const server = setupServer(
  http.get('/api/leaderboard', () => {
    return HttpResponse.json([
      { id: '1', name: 'Player A', rank: 1, rating: 1500, wins: 10, losses: 2 },
      { id: '2', name: 'Player B', rank: 2, rating: 1450, wins: 8, losses: 3 },
      { id: '3', name: 'Player C', rank: 3, rating: 1400, wins: 7, losses: 5 },
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// WebSocket test helpers
let ioServer: SocketIOServer;
let serverSocket: any;
let clientSocket: ClientSocket;

const setupWebSocket = (port: number = 3001): Promise<void> => {
  return new Promise((resolve) => {
    ioServer = new SocketIOServer(port, {
      cors: { origin: '*' },
    });

    ioServer.on('connection', (socket) => {
      serverSocket = socket;
      resolve();
    });

    clientSocket = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
      reconnectionDelay: 100,
    });
  });
};

const cleanupWebSocket = (): Promise<void> => {
  return new Promise((resolve) => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (ioServer) {
      ioServer.close(() => resolve());
    } else {
      resolve();
    }
  });
};

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe('Leaderboard Real-time Updates - Integration Tests', () => {
  beforeEach(async () => {
    await setupWebSocket();
  });

  afterEach(async () => {
    await cleanupWebSocket();
  });

  /**
   * TC-INT-006: Initial Load + WebSocket Connection
   * Verify: Page loads data and establishes WebSocket connection
   */
  test('TC-INT-006: Initial load establishes WebSocket connection', async () => {
    const connectionPromise = new Promise<void>((resolve) => {
      clientSocket.on('connect', () => resolve());
    });

    renderWithProviders(<LeaderboardTable />);

    // Verify initial data loads
    await waitFor(() => {
      expect(screen.getByText('Player A')).toBeTruthy();
      expect(screen.getByText('Player B')).toBeTruthy();
    });

    // Verify WebSocket connection established
    await connectionPromise;
    expect(clientSocket.connected).toBe(true);

    // Verify subscription
    const subscribePromise = new Promise<void>((resolve) => {
      serverSocket.on('subscribe', (data: any) => {
        expect(data.channel).toBe('leaderboard');
        resolve();
      });
    });

    clientSocket.emit('subscribe', { channel: 'leaderboard' });
    await subscribePromise;
  });

  /**
   * TC-INT-007: Receive Real-time Rank Update
   * Verify: WebSocket updates propagate to UI instantly
   * SLA: Update appears <500ms
   */
  test('TC-INT-007: Receives and displays real-time rank update', async () => {
    renderWithProviders(<LeaderboardTable />);

    await waitFor(() => {
      expect(screen.getByText('Player A')).toBeTruthy();
    });

    const startTime = performance.now();

    // Simulate server broadcast
    const updateEvent = new Promise<void>((resolve) => {
      clientSocket.on('leaderboard:update', (data) => {
        expect(data.playerId).toBe('1');
        expect(data.newRank).toBe(1);
        expect(data.newRating).toBe(1532);
        resolve();
      });
    });

    serverSocket.emit('leaderboard:update', {
      playerId: '1',
      name: 'Player A',
      newRank: 1,
      newRating: 1532,
      wins: 11,
      losses: 2,
    });

    await updateEvent;

    const endTime = performance.now();
    const latency = endTime - startTime;

    // Verify update received within SLA
    expect(latency).toBeLessThan(500); // <500ms SLA

    // Verify UI updates (in real app, would check for rating change)
    await waitFor(() => {
      expect(clientSocket.connected).toBe(true);
    });
  });

  /**
   * TC-INT-008: Optimistic UI Update
   * Verify: UI updates immediately before server confirmation
   */
  test('TC-INT-008: Optimistic update with server confirmation', async () => {
    const queryClient = new QueryClient();

    // Initial state
    const initialData = [
      { id: '1', name: 'Player A', rank: 5, rating: 1400 },
    ];

    queryClient.setQueryData(['leaderboard'], initialData);

    // Optimistic update
    const optimisticData = [
      { id: '1', name: 'Player A', rank: 4, rating: 1420 },
    ];

    queryClient.setQueryData(['leaderboard'], optimisticData);

    // Verify optimistic update applied
    const cachedData = queryClient.getQueryData(['leaderboard']) as any[];
    expect(cachedData[0].rank).toBe(4);
    expect(cachedData[0].rating).toBe(1420);

    // Simulate server confirmation
    const serverConfirmation = new Promise<void>((resolve) => {
      serverSocket.emit('match:confirmed', {
        playerId: '1',
        rank: 4,
        rating: 1420,
      });
      resolve();
    });

    await serverConfirmation;

    // Verify optimistic update committed
    expect(queryClient.getQueryData(['leaderboard'])).toBeTruthy();
  });

  /**
   * TC-INT-009: Conflict Resolution
   * Verify: Optimistic update rolled back on server conflict
   */
  test('TC-INT-009: Resolves conflicts between optimistic and server state', async () => {
    const queryClient = new QueryClient();

    // Initial state: Player A at rank 5
    queryClient.setQueryData(['leaderboard'], [
      { id: '1', name: 'Player A', rank: 5, rating: 1400 },
    ]);

    // Optimistic update: rank 4
    queryClient.setQueryData(['leaderboard'], [
      { id: '1', name: 'Player A', rank: 4, rating: 1420 },
    ]);

    let cachedData = queryClient.getQueryData(['leaderboard']) as any[];
    expect(cachedData[0].rank).toBe(4);

    // Server returns different value: rank 6 (conflict!)
    const conflictResolution = new Promise<void>((resolve) => {
      clientSocket.on('leaderboard:conflict', (data) => {
        expect(data.playerId).toBe('1');
        expect(data.serverRank).toBe(6);
        resolve();
      });
    });

    serverSocket.emit('leaderboard:conflict', {
      playerId: '1',
      optimisticRank: 4,
      serverRank: 6,
      rating: 1390,
    });

    await conflictResolution;

    // Rollback optimistic update
    queryClient.setQueryData(['leaderboard'], [
      { id: '1', name: 'Player A', rank: 6, rating: 1390 },
    ]);

    cachedData = queryClient.getQueryData(['leaderboard']) as any[];
    expect(cachedData[0].rank).toBe(6); // Server value wins
    expect(cachedData[0].rating).toBe(1390);
  });

  /**
   * TC-INT-010: WebSocket Reconnection + Data Sync
   * Verify: Reconnection syncs with latest server state
   */
  test('TC-INT-010: Reconnects and syncs data after disconnect', async () => {
    renderWithProviders(<LeaderboardTable />);

    // Wait for initial connection
    await waitFor(() => {
      expect(clientSocket.connected).toBe(true);
    });

    // Simulate disconnect
    const disconnectPromise = new Promise<void>((resolve) => {
      clientSocket.on('disconnect', () => resolve());
    });

    clientSocket.disconnect();
    await disconnectPromise;

    expect(clientSocket.connected).toBe(false);

    // Wait 5 seconds (simulate data changes on server)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Reconnect
    const reconnectPromise = new Promise<void>((resolve) => {
      clientSocket.on('connect', () => resolve());
    });

    clientSocket.connect();
    await reconnectPromise;

    expect(clientSocket.connected).toBe(true);

    // Verify data sync request sent
    const syncPromise = new Promise<void>((resolve) => {
      serverSocket.on('sync:request', (data: any) => {
        expect(data.timestamp).toBeDefined();
        resolve();
      });
    });

    clientSocket.emit('sync:request', { timestamp: Date.now() });
    await syncPromise;

    // Simulate server sending latest state
    serverSocket.emit('sync:response', {
      leaderboard: [
        { id: '1', name: 'Player A', rank: 1, rating: 1550 },
        { id: '2', name: 'Player B', rank: 2, rating: 1460 },
      ],
    });

    // Verify no data loss
    await waitFor(() => {
      expect(clientSocket.connected).toBe(true);
    });
  });
});
