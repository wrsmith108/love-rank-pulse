/**
 * WebSocket Integration Tests
 * Tests real-time update functionality and Socket.io integration
 */

import '@testing-library/jest-dom';
import React, { useEffect, useState } from 'react';
import { screen, waitFor, act } from '@testing-library/react';
import { renderWithAllProviders } from '../utils/testQueryProvider';
import {
  createMockSocketClient,
  mockWebSocketEvents,
  socketTestUtils,
  MockSocketClient
} from '../utils/mockSocketClient';

/**
 * Test component that uses WebSocket
 */
interface WebSocketTestComponentProps {
  socket: MockSocketClient;
  onRankChange?: (data: any) => void;
}

const WebSocketTestComponent: React.FC<WebSocketTestComponentProps> = ({ socket, onRankChange }) => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [rankChanges, setRankChanges] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Connection handlers
    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('error', (err: Error) => {
      setError(err.message);
    });

    // Rank change handler
    socket.on('rankChange', (data: any) => {
      setRankChanges(prev => [...prev, data]);
      onRankChange?.(data);
    });

    return () => {
      socket.removeAllListeners();
    };
  }, [socket, onRankChange]);

  return (
    <div data-testid="websocket-component">
      <div data-testid="connection-status">
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      {error && <div data-testid="error-message">{error}</div>}
      <div data-testid="rank-changes-count">{rankChanges.length}</div>
      {rankChanges.map((change, index) => (
        <div key={index} data-testid={`rank-change-${index}`}>
          Player {change.playerId}: {change.oldRank} → {change.newRank}
        </div>
      ))}
    </div>
  );
};

describe('WebSocket Integration Tests', () => {
  let mockSocket: MockSocketClient;

  beforeEach(() => {
    mockSocket = createMockSocketClient(false);
  });

  afterEach(() => {
    mockSocket.reset();
  });

  describe('WebSocket Connection', () => {
    it('should connect to WebSocket successfully', async () => {
      renderWithAllProviders(<WebSocketTestComponent socket={mockSocket} />);

      expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');

      act(() => {
        mockSocket.connect();
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });

      expect(mockSocket.connected).toBe(true);
    });

    it('should disconnect from WebSocket', async () => {
      mockSocket.connect();

      renderWithAllProviders(<WebSocketTestComponent socket={mockSocket} />);

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });

      act(() => {
        mockSocket.disconnect();
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
      });

      expect(mockSocket.connected).toBe(false);
    });

    it('should handle connection errors', async () => {
      mockSocket.connect();

      renderWithAllProviders(<WebSocketTestComponent socket={mockSocket} />);

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });

      act(() => {
        mockSocket.simulateError(new Error('Connection failed'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Connection failed');
      });
    });
  });

  describe('Event Subscriptions', () => {
    it('should subscribe to rankChange events', async () => {
      mockSocket.connect();

      const onRankChange = jest.fn();
      renderWithAllProviders(
        <WebSocketTestComponent socket={mockSocket} onRankChange={onRankChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });

      const rankChangeData = mockWebSocketEvents.rankChange('player-1');

      act(() => {
        mockSocket.simulateServerEvent('rankChange', rankChangeData);
      });

      await waitFor(() => {
        expect(onRankChange).toHaveBeenCalledWith(rankChangeData);
        expect(screen.getByTestId('rank-changes-count')).toHaveTextContent('1');
      });
    });

    it('should handle multiple rankChange events', async () => {
      mockSocket.connect();

      renderWithAllProviders(<WebSocketTestComponent socket={mockSocket} />);

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });

      // Emit multiple events
      act(() => {
        mockSocket.simulateServerEvent('rankChange', mockWebSocketEvents.rankChange('player-1'));
        mockSocket.simulateServerEvent('rankChange', mockWebSocketEvents.rankChange('player-2'));
        mockSocket.simulateServerEvent('rankChange', mockWebSocketEvents.rankChange('player-3'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('rank-changes-count')).toHaveTextContent('3');
      });

      expect(screen.getByTestId('rank-change-0')).toBeInTheDocument();
      expect(screen.getByTestId('rank-change-1')).toBeInTheDocument();
      expect(screen.getByTestId('rank-change-2')).toBeInTheDocument();
    });

    it('should subscribe to multiple event types', async () => {
      const events = ['rankChange', 'playerJoined', 'matchUpdate'];
      const receivedEvents: string[] = [];

      mockSocket.connect();

      events.forEach(event => {
        mockSocket.on(event, () => {
          receivedEvents.push(event);
        });
      });

      // Emit all events
      act(() => {
        mockSocket.simulateServerEvent('rankChange', mockWebSocketEvents.rankChange());
        mockSocket.simulateServerEvent('playerJoined', mockWebSocketEvents.playerJoined());
        mockSocket.simulateServerEvent('matchUpdate', mockWebSocketEvents.matchUpdate());
      });

      await waitFor(() => {
        expect(receivedEvents).toHaveLength(3);
        expect(receivedEvents).toContain('rankChange');
        expect(receivedEvents).toContain('playerJoined');
        expect(receivedEvents).toContain('matchUpdate');
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should update UI in real-time when receiving events', async () => {
      mockSocket.connect();

      renderWithAllProviders(<WebSocketTestComponent socket={mockSocket} />);

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });

      const rankChangeData = {
        playerId: 'player-1',
        oldRank: 10,
        newRank: 8,
        scope: 'global' as const,
        timestamp: new Date().toISOString()
      };

      act(() => {
        mockSocket.simulateServerEvent('rankChange', rankChangeData);
      });

      await waitFor(() => {
        const rankChangeElement = screen.getByTestId('rank-change-0');
        expect(rankChangeElement).toHaveTextContent('Player player-1: 10 → 8');
      });
    });

    it('should handle rapid successive updates', async () => {
      mockSocket.connect();

      renderWithAllProviders(<WebSocketTestComponent socket={mockSocket} />);

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });

      // Emit 10 events rapidly
      act(() => {
        for (let i = 0; i < 10; i++) {
          mockSocket.simulateServerEvent('rankChange', {
            playerId: `player-${i}`,
            oldRank: i + 10,
            newRank: i + 5,
            scope: 'global',
            timestamp: new Date().toISOString()
          });
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('rank-changes-count')).toHaveTextContent('10');
      });
    });
  });

  describe('Reconnection Handling', () => {
    it('should handle reconnection after disconnect', async () => {
      mockSocket.connect();

      renderWithAllProviders(<WebSocketTestComponent socket={mockSocket} />);

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });

      // Disconnect
      act(() => {
        mockSocket.disconnect();
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
      });

      // Reconnect
      act(() => {
        mockSocket.connect();
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
    });

    it('should simulate reconnection scenario', async () => {
      mockSocket.connect();

      renderWithAllProviders(<WebSocketTestComponent socket={mockSocket} />);

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });

      // Simulate reconnect (disconnect + connect)
      await act(async () => {
        mockSocket.simulateReconnect();
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
    });
  });

  describe('Event History Tracking', () => {
    it('should track emitted events', async () => {
      mockSocket.connect();

      act(() => {
        mockSocket.emit('customEvent', { data: 'test' });
        mockSocket.emit('anotherEvent', { data: 'test2' });
      });

      const history = mockSocket.getEventHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(mockSocket.wasEventEmitted('customEvent')).toBe(true);
      expect(mockSocket.wasEventEmitted('anotherEvent')).toBe(true);
    });

    it('should filter events by type', async () => {
      mockSocket.connect();

      act(() => {
        mockSocket.emit('rankChange', { test: 1 });
        mockSocket.emit('rankChange', { test: 2 });
        mockSocket.emit('playerJoined', { test: 3 });
      });

      const rankChangeEvents = mockSocket.getEventsOfType('rankChange');
      const playerJoinedEvents = mockSocket.getEventsOfType('playerJoined');

      // Note: connect event is also emitted
      expect(rankChangeEvents.length).toBeGreaterThanOrEqual(2);
      expect(playerJoinedEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should clear event history', async () => {
      mockSocket.connect();

      act(() => {
        mockSocket.emit('testEvent', { data: 'test' });
      });

      expect(mockSocket.getEventHistory().length).toBeGreaterThan(0);

      mockSocket.clearEventHistory();

      expect(mockSocket.getEventHistory().length).toBe(0);
    });
  });

  describe('Event Utilities', () => {
    it('should wait for specific event', async () => {
      mockSocket.connect();

      const eventPromise = socketTestUtils.waitForEvent(mockSocket, 'testEvent', 500);

      act(() => {
        mockSocket.emit('testEvent', { data: 'test' });
      });

      const eventData = await eventPromise;
      expect(eventData).toEqual({ data: 'test' });
    });

    it('should timeout waiting for event', async () => {
      mockSocket.connect();

      await expect(
        socketTestUtils.waitForEvent(mockSocket, 'nonExistentEvent', 100)
      ).rejects.toThrow('Timeout waiting for event: nonExistentEvent');
    });

    it('should assert event was emitted', async () => {
      mockSocket.connect();

      act(() => {
        mockSocket.emit('testEvent', { data: 'test' });
      });

      expect(() => {
        socketTestUtils.assertEventEmitted(mockSocket, 'testEvent');
      }).not.toThrow();

      expect(() => {
        socketTestUtils.assertEventEmitted(mockSocket, 'nonExistentEvent');
      }).toThrow('Event nonExistentEvent was not emitted');
    });
  });

  describe('WebSocket Event Data', () => {
    it('should create valid rankChange event data', () => {
      const eventData = mockWebSocketEvents.rankChange('player-123');

      expect(eventData.playerId).toBe('player-123');
      expect(eventData.oldRank).toBe(10);
      expect(eventData.newRank).toBe(8);
      expect(eventData.scope).toBe('global');
      expect(eventData.timestamp).toBeDefined();
    });

    it('should create valid playerJoined event data', () => {
      const eventData = mockWebSocketEvents.playerJoined('player-123', 'TestPlayer');

      expect(eventData.playerId).toBe('player-123');
      expect(eventData.playerName).toBe('TestPlayer');
      expect(eventData.timestamp).toBeDefined();
    });

    it('should create valid leaderboardUpdate event data', () => {
      const eventData = mockWebSocketEvents.leaderboardUpdate('country');

      expect(eventData.scope).toBe('country');
      expect(eventData.affectedPlayerIds).toHaveLength(3);
      expect(eventData.timestamp).toBeDefined();
    });
  });
});
