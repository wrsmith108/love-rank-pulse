/**
 * Mock Socket.io client for testing WebSocket functionality
 * Provides event emitter interface compatible with socket.io-client
 */

import { EventEmitter } from 'events';

/**
 * WebSocket event types
 */
export type SocketEvent =
  | 'connect'
  | 'disconnect'
  | 'error'
  | 'rankChange'
  | 'playerJoined'
  | 'playerLeft'
  | 'matchUpdate'
  | 'leaderboardUpdate';

/**
 * Mock Socket.io client
 */
export class MockSocketClient extends EventEmitter {
  public connected: boolean = false;
  public id: string = 'mock-socket-id';
  private eventHistory: Array<{ event: string; data?: any; timestamp: Date }> = [];
  private autoConnect: boolean;

  constructor(autoConnect: boolean = true) {
    super();
    this.autoConnect = autoConnect;

    if (autoConnect) {
      this.connect();
    }
  }

  /**
   * Connect to socket
   */
  public connect(): MockSocketClient {
    if (!this.connected) {
      this.connected = true;
      setTimeout(() => {
        this.emit('connect');
      }, 10);
    }
    return this;
  }

  /**
   * Disconnect from socket
   */
  public disconnect(): MockSocketClient {
    if (this.connected) {
      this.connected = false;
      this.emit('disconnect', 'client disconnect');
    }
    return this;
  }

  /**
   * Emit event to server (tracked for testing)
   */
  public emit(event: string, ...args: any[]): boolean {
    this.eventHistory.push({
      event,
      data: args,
      timestamp: new Date()
    });
    return super.emit(event, ...args);
  }

  /**
   * Simulate receiving event from server
   */
  public simulateServerEvent(event: SocketEvent, data?: any): void {
    this.emit(event, data);
  }

  /**
   * Simulate connection error
   */
  public simulateError(error: Error | string): void {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    this.emit('error', errorObj);
  }

  /**
   * Simulate reconnection
   */
  public simulateReconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 100);
  }

  /**
   * Get event history for assertions
   */
  public getEventHistory() {
    return this.eventHistory;
  }

  /**
   * Clear event history
   */
  public clearEventHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get events of specific type
   */
  public getEventsOfType(eventType: string) {
    return this.eventHistory.filter(e => e.event === eventType);
  }

  /**
   * Check if event was emitted
   */
  public wasEventEmitted(eventType: string): boolean {
    return this.eventHistory.some(e => e.event === eventType);
  }

  /**
   * Close socket (alias for disconnect)
   */
  public close(): void {
    this.disconnect();
  }

  /**
   * Reset mock state
   */
  public reset(): void {
    this.removeAllListeners();
    this.clearEventHistory();
    this.disconnect();
  }
}

/**
 * Create a mock socket client instance
 */
export function createMockSocketClient(autoConnect: boolean = true): MockSocketClient {
  return new MockSocketClient(autoConnect);
}

/**
 * Mock socket.io-client module
 */
export function mockSocketIO() {
  return {
    io: jest.fn(() => createMockSocketClient()),
    Socket: MockSocketClient
  };
}

/**
 * WebSocket event data types
 */
export interface RankChangeEvent {
  playerId: string;
  oldRank: number;
  newRank: number;
  scope: 'global' | 'country' | 'session';
  timestamp: string;
}

export interface PlayerJoinedEvent {
  playerId: string;
  playerName: string;
  timestamp: string;
}

export interface PlayerLeftEvent {
  playerId: string;
  playerName: string;
  timestamp: string;
}

export interface MatchUpdateEvent {
  matchId: string;
  status: 'starting' | 'in_progress' | 'completed';
  timestamp: string;
}

export interface LeaderboardUpdateEvent {
  scope: 'global' | 'country' | 'session';
  affectedPlayerIds: string[];
  timestamp: string;
}

/**
 * Create mock WebSocket event data
 */
export const mockWebSocketEvents = {
  rankChange: (playerId: string = 'player-1'): RankChangeEvent => ({
    playerId,
    oldRank: 10,
    newRank: 8,
    scope: 'global',
    timestamp: new Date().toISOString()
  }),

  playerJoined: (playerId: string = 'player-1', playerName: string = 'TestPlayer'): PlayerJoinedEvent => ({
    playerId,
    playerName,
    timestamp: new Date().toISOString()
  }),

  playerLeft: (playerId: string = 'player-1', playerName: string = 'TestPlayer'): PlayerLeftEvent => ({
    playerId,
    playerName,
    timestamp: new Date().toISOString()
  }),

  matchUpdate: (matchId: string = 'match-1', status: 'starting' | 'in_progress' | 'completed' = 'in_progress'): MatchUpdateEvent => ({
    matchId,
    status,
    timestamp: new Date().toISOString()
  }),

  leaderboardUpdate: (scope: 'global' | 'country' | 'session' = 'global'): LeaderboardUpdateEvent => ({
    scope,
    affectedPlayerIds: ['player-1', 'player-2', 'player-3'],
    timestamp: new Date().toISOString()
  })
};

/**
 * WebSocket test utilities
 */
export const socketTestUtils = {
  /**
   * Wait for socket event
   */
  waitForEvent: (socket: MockSocketClient, event: string, timeout: number = 1000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      socket.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  },

  /**
   * Wait for multiple events
   */
  waitForEvents: async (
    socket: MockSocketClient,
    events: string[],
    timeout: number = 1000
  ): Promise<any[]> => {
    return Promise.all(
      events.map(event => socketTestUtils.waitForEvent(socket, event, timeout))
    );
  },

  /**
   * Assert event was emitted with data
   */
  assertEventEmitted: (
    socket: MockSocketClient,
    event: string,
    expectedData?: any
  ): void => {
    const events = socket.getEventsOfType(event);

    if (events.length === 0) {
      throw new Error(`Event ${event} was not emitted`);
    }

    if (expectedData !== undefined) {
      const lastEvent = events[events.length - 1];
      expect(lastEvent.data).toEqual([expectedData]);
    }
  }
};
