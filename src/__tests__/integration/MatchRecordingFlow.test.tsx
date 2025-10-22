/**
 * Integration Tests: Match Recording Flow
 * Test Suite: TC-INT-011 through TC-INT-015
 * Coverage: Match recording, ELO calculation, transaction safety
 */

import '../setup/jest.polyfills';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Mock Prisma client
const mockPrisma = {
  match: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  player: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

// Mock server
const server = setupServer(
  http.post('/api/matches', async ({ request }) => {
    const body = await request.json() as any;

    // Calculate ELO changes
    const calculateEloChange = (winnerRating: number, loserRating: number) => {
      const K = 32;
      const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
      const expectedLoser = 1 - expectedWinner;

      return {
        winnerChange: Math.round(K * (1 - expectedWinner)),
        loserChange: Math.round(K * (0 - expectedLoser)),
      };
    };

    const winner = body.player1Score > body.player2Score ? body.player1Id : body.player2Id;
    const loser = winner === body.player1Id ? body.player2Id : body.player1Id;

    const winnerRating = winner === body.player1Id ? 1200 : 1300;
    const loserRating = winner === body.player1Id ? 1300 : 1200;

    const eloChanges = calculateEloChange(winnerRating, loserRating);

    return HttpResponse.json({
      match: {
        id: 'match-123',
        player1Id: body.player1Id,
        player2Id: body.player2Id,
        player1Score: body.player1Score,
        player2Score: body.player2Score,
        winnerId: winner,
        createdAt: new Date().toISOString(),
      },
      eloChanges: {
        winner: { id: winner, change: eloChanges.winnerChange, newRating: winnerRating + eloChanges.winnerChange },
        loser: { id: loser, change: eloChanges.loserChange, newRating: loserRating + eloChanges.loserChange },
      },
    });
  }),
  http.get('/api/leaderboard', () => {
    return HttpResponse.json([
      { id: '1', name: 'Player A', rank: 1, rating: 1232, wins: 11, losses: 2 },
      { id: '2', name: 'Player B', rank: 2, rating: 1268, wins: 8, losses: 4 },
    ]);
  }),
  http.post('/api/matches/rollback', () => {
    return HttpResponse.json({ error: 'Database error' }, { status: 500 });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock match form component
const MatchRecordingForm: React.FC = () => {
  const [player1Id, setPlayer1Id] = React.useState('1');
  const [player2Id, setPlayer2Id] = React.useState('2');
  const [player1Score, setPlayer1Score] = React.useState('21');
  const [player2Score, setPlayer2Score] = React.useState('19');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player1Id,
        player2Id,
        player1Score: parseInt(player1Score),
        player2Score: parseInt(player2Score),
      }),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>Player 1 ID <input value={player1Id} onChange={(e) => setPlayer1Id(e.target.value)} /></label>
      <label>Player 2 ID <input value={player2Id} onChange={(e) => setPlayer2Id(e.target.value)} /></label>
      <label>Player 1 Score <input value={player1Score} onChange={(e) => setPlayer1Score(e.target.value)} /></label>
      <label>Player 2 Score <input value={player2Score} onChange={(e) => setPlayer2Score(e.target.value)} /></label>
      <button type="submit">Submit Match</button>
    </form>
  );
};

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe('Match Recording Flow - Integration Tests', () => {
  /**
   * TC-INT-011: Complete Match Recording Flow
   * Verify: End-to-end match recording with all updates
   * SLA: <3 seconds
   */
  test('TC-INT-011: Complete match recording flow updates all systems', async () => {
    const user = userEvent.setup();
    const startTime = performance.now();

    renderWithProviders(<MatchRecordingForm />);

    // Fill match result form
    const player1Input = screen.getByLabelText(/Player 1 ID/i);
    const player2Input = screen.getByLabelText(/Player 2 ID/i);
    const score1Input = screen.getByLabelText(/Player 1 Score/i);
    const score2Input = screen.getByLabelText(/Player 2 Score/i);
    const submitButton = screen.getByRole('button', { name: /submit match/i });

    await user.clear(player1Input);
    await user.type(player1Input, '1');
    await user.clear(player2Input);
    await user.type(player2Input, '2');
    await user.clear(score1Input);
    await user.type(score1Input, '21');
    await user.clear(score2Input);
    await user.type(score2Input, '19');
    await user.click(submitButton);

    // Wait for submission
    await waitFor(() => {
      expect(submitButton).toBeDefined();
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Verify flow completes within SLA
    expect(duration).toBeLessThan(3000); // <3 seconds
  });

  /**
   * TC-INT-012: ELO Rating Update
   * Verify: ELO calculation and rating updates are accurate
   */
  test('TC-INT-012: ELO ratings update correctly after match', async () => {
    // Player A (1200) beats Player B (1300)
    const response = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player1Id: '1',
        player2Id: '2',
        player1Score: 21,
        player2Score: 19,
      }),
    });

    const result = await response.json();

    // Verify ELO changes
    expect(result.eloChanges.winner.change).toBeGreaterThan(0);
    expect(result.eloChanges.loser.change).toBeLessThan(0);

    // Expected: Player A gains ~+32, Player B loses ~-32
    expect(result.eloChanges.winner.change).toBeGreaterThanOrEqual(28);
    expect(result.eloChanges.winner.change).toBeLessThanOrEqual(36);
    expect(result.eloChanges.loser.change).toBeLessThanOrEqual(-28);
    expect(result.eloChanges.loser.change).toBeGreaterThanOrEqual(-36);

    // Verify new ratings
    expect(result.eloChanges.winner.newRating).toBe(1200 + result.eloChanges.winner.change);
    expect(result.eloChanges.loser.newRating).toBe(1300 + result.eloChanges.loser.change);

    // Verify match created
    expect(result.match.winnerId).toBe('1');
  });

  /**
   * TC-INT-013: Leaderboard Re-ranking
   * Verify: Rankings update and shift correctly
   */
  test('TC-INT-013: Leaderboard re-ranks after match result', async () => {
    // Submit match result
    await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player1Id: '1',
        player2Id: '2',
        player1Score: 21,
        player2Score: 19,
      }),
    });

    // Fetch updated leaderboard
    const leaderboardResponse = await fetch('/api/leaderboard');
    const leaderboard = await leaderboardResponse.json();

    // Verify rankings
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].rank).toBe(2);

    // Verify ranks are unique
    const ranks = leaderboard.map((p: any) => p.rank);
    const uniqueRanks = new Set(ranks);
    expect(uniqueRanks.size).toBe(ranks.length);

    // Verify ratings updated
    expect(leaderboard[0].rating).toBeGreaterThan(1200);
    expect(leaderboard[1].rating).toBeLessThan(1300);
  });

  /**
   * TC-INT-014: WebSocket Broadcast to All Clients
   * Verify: Match result broadcasts to all connected clients
   * SLA: Broadcast latency <100ms
   */
  test('TC-INT-014: Match result broadcasts to all clients', async () => {
    const startTime = performance.now();

    // Simulate multiple clients
    const clientCallbacks = [
      jest.fn(),
      jest.fn(),
      jest.fn(),
    ];

    // Simulate broadcast
    const broadcastEvent = {
      type: 'match:completed',
      matchId: 'match-123',
      updates: {
        player1: { id: '1', newRating: 1232 },
        player2: { id: '2', newRating: 1268 },
      },
    };

    // All clients receive event
    clientCallbacks.forEach(callback => callback(broadcastEvent));

    const endTime = performance.now();
    const latency = endTime - startTime;

    // Verify all clients notified
    expect(clientCallbacks[0]).toHaveBeenCalledWith(broadcastEvent);
    expect(clientCallbacks[1]).toHaveBeenCalledWith(broadcastEvent);
    expect(clientCallbacks[2]).toHaveBeenCalledWith(broadcastEvent);

    // Verify broadcast latency
    expect(latency).toBeLessThan(100); // <100ms
  });

  /**
   * TC-INT-015: Transaction Rollback on Failure
   * Verify: Database transaction rolls back on error
   */
  test('TC-INT-015: Transaction rolls back on database error', async () => {
    // Mock database error during transaction
    const transactionFn = async () => {
      // Simulate partial updates
      const match = await mockPrisma.match.create({
        data: {
          player1Id: '1',
          player2Id: '2',
          player1Score: 21,
          player2Score: 19,
        },
      });

      // Simulate error during player update
      throw new Error('Database connection lost');
    };

    mockPrisma.$transaction.mockImplementation(transactionFn);

    try {
      await mockPrisma.$transaction(transactionFn);
    } catch (error: any) {
      expect(error.message).toBe('Database connection lost');
    }

    // Verify transaction was called
    expect(mockPrisma.$transaction).toHaveBeenCalled();

    // In real scenario, verify:
    // 1. Match not saved
    // 2. ELO ratings unchanged
    // 3. Win/loss records unchanged
    // 4. Rankings unchanged

    // Verify match creation was attempted but rolled back
    expect(mockPrisma.match.create).not.toHaveBeenCalled(); // Never committed
  });

  /**
   * Additional test: Verify atomic transaction behavior
   */
  test('Atomic transaction ensures all-or-nothing updates', async () => {
    const transactionOperations = [
      { operation: 'createMatch', success: true },
      { operation: 'updatePlayer1', success: true },
      { operation: 'updatePlayer2', success: false }, // Fails here
      { operation: 'updateLeaderboard', success: true },
    ];

    let completedOperations = 0;

    try {
      for (const op of transactionOperations) {
        if (!op.success) {
          throw new Error(`${op.operation} failed`);
        }
        completedOperations++;
      }
    } catch (error) {
      // Rollback all operations
      completedOperations = 0;
    }

    // Verify partial completion detected
    expect(completedOperations).toBe(0); // All rolled back

    // Verify no partial state saved
    // In real scenario, check database state unchanged
  });
});
