/**
 * Mock Prisma Client for testing
 * Provides comprehensive mocking for all Prisma models
 */

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

export type MockPrismaClient = DeepMockProxy<PrismaClient>;

let prisma: MockPrismaClient;

beforeEach(() => {
  prisma = mockDeep<PrismaClient>();
  mockReset(prisma);
});

export const createMockPrismaClient = (): MockPrismaClient => {
  return mockDeep<PrismaClient>();
};

export const getMockPrismaClient = (): MockPrismaClient => {
  if (!prisma) {
    prisma = mockDeep<PrismaClient>();
  }
  return prisma;
};

export const resetMockPrisma = () => {
  if (prisma) {
    mockReset(prisma);
  }
};

// Helper functions for common mock patterns
export const mockPrismaPlayer = (overrides = {}) => ({
  id: 'player-123',
  username: 'testuser',
  email: 'test@example.com',
  password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz',
  elo_rating: 1200,
  rank: 0,
  matches_played: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  avatar_url: null,
  bio: null,
  country_code: 'US',
  is_active: true,
  is_verified: false,
  last_active_at: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
});

export const mockPrismaMatch = (overrides = {}) => ({
  id: 'match-123',
  player1_id: 'player-1',
  player2_id: 'player-2',
  status: 'COMPLETED',
  match_type: 'RANKED',
  tournament_id: null,
  round_number: null,
  scheduled_at: null,
  started_at: new Date(),
  completed_at: new Date(),
  best_of: 1,
  time_limit: null,
  notes: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
});

export const mockPrismaMatchResult = (overrides = {}) => ({
  id: 'result-123',
  match_id: 'match-123',
  winner_id: 'player-1',
  loser_id: 'player-2',
  result_type: 'WIN',
  player1_score: 10,
  player2_score: 5,
  rating_change: 24,
  winner_new_elo: 1224,
  loser_new_elo: 1176,
  k_factor: 32,
  verification_status: 'VERIFIED',
  verified_by: null,
  verified_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
});

export const mockPrismaLeaderboardEntry = (overrides = {}) => ({
  id: 'entry-123',
  player_id: 'player-123',
  rank: 1,
  previous_rank: 2,
  rank_change: 1,
  elo_rating: 1224,
  previous_elo: 1200,
  peak_elo: 1224,
  lowest_elo: 1200,
  matches_played: 10,
  wins: 6,
  losses: 4,
  draws: 0,
  win_rate: 0.6,
  current_streak: 2,
  best_win_streak: 3,
  season_id: null,
  leaderboard_type: 'GLOBAL',
  is_active: true,
  last_match_at: new Date(),
  last_updated: new Date(),
  created_at: new Date(),
  ...overrides
});

export default getMockPrismaClient;
