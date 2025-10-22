/**
 * Test Data Factories
 * Generate realistic test data for all models
 */

import { faker } from '@faker-js/faker';

export interface PlayerFactory {
  id?: string;
  username?: string;
  email?: string;
  password_hash?: string;
  elo_rating?: number;
  rank?: number;
  matches_played?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  avatar_url?: string | null;
  bio?: string | null;
  country_code?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
}

export interface MatchFactory {
  id?: string;
  player1_id?: string;
  player2_id?: string;
  status?: string;
  match_type?: string;
  started_at?: Date;
  completed_at?: Date;
}

export interface MatchResultFactory {
  id?: string;
  match_id?: string;
  winner_id?: string;
  loser_id?: string;
  result_type?: string;
  player1_score?: number;
  player2_score?: number;
  rating_change?: number;
}

export interface LeaderboardEntryFactory {
  id?: string;
  player_id?: string;
  rank?: number;
  elo_rating?: number;
  wins?: number;
  losses?: number;
}

/**
 * Create a player with realistic data
 */
export const createPlayerFactory = (overrides: PlayerFactory = {}) => {
  const username = overrides.username || faker.internet.userName();

  return {
    id: faker.string.uuid(),
    username,
    email: overrides.email || faker.internet.email({ firstName: username }),
    password_hash: '$2b$10$' + faker.string.alphanumeric(53),
    elo_rating: faker.number.int({ min: 800, max: 2400 }),
    rank: faker.number.int({ min: 0, max: 10000 }),
    matches_played: faker.number.int({ min: 0, max: 500 }),
    wins: faker.number.int({ min: 0, max: 300 }),
    losses: faker.number.int({ min: 0, max: 300 }),
    draws: faker.number.int({ min: 0, max: 50 }),
    avatar_url: faker.helpers.maybe(() => faker.image.avatar(), { probability: 0.7 }),
    bio: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    country_code: faker.location.countryCode(),
    is_active: true,
    is_verified: faker.datatype.boolean({ probability: 0.8 }),
    last_active_at: faker.date.recent({ days: 7 }),
    created_at: faker.date.past({ years: 2 }),
    updated_at: new Date(),
    ...overrides
  };
};

/**
 * Create a match with realistic data
 */
export const createMatchFactory = (overrides: MatchFactory = {}) => {
  const startedAt = faker.date.recent({ days: 30 });
  const duration = faker.number.int({ min: 300, max: 3600 }); // 5-60 minutes
  const completedAt = new Date(startedAt.getTime() + duration * 1000);

  return {
    id: faker.string.uuid(),
    player1_id: faker.string.uuid(),
    player2_id: faker.string.uuid(),
    status: 'COMPLETED',
    match_type: faker.helpers.arrayElement(['RANKED', 'UNRANKED', 'TOURNAMENT', 'FRIENDLY']),
    tournament_id: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.3 }),
    round_number: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 8 }), { probability: 0.3 }),
    scheduled_at: null,
    started_at: startedAt,
    completed_at: completedAt,
    best_of: faker.helpers.arrayElement([1, 3, 5]),
    time_limit: faker.helpers.maybe(() => faker.number.int({ min: 600, max: 3600 }), { probability: 0.5 }),
    notes: null,
    created_at: faker.date.past({ years: 1 }),
    updated_at: new Date(),
    ...overrides
  };
};

/**
 * Create a match result with realistic data
 */
export const createMatchResultFactory = (overrides: MatchResultFactory = {}) => {
  const player1Score = faker.number.int({ min: 0, max: 30 });
  const player2Score = faker.number.int({ min: 0, max: 30 });
  const winner_id = player1Score > player2Score ? 'player-1' : 'player-2';
  const loser_id = winner_id === 'player-1' ? 'player-2' : 'player-1';

  return {
    id: faker.string.uuid(),
    match_id: faker.string.uuid(),
    winner_id,
    loser_id,
    result_type: player1Score === player2Score ? 'DRAW' : 'WIN',
    player1_score: player1Score,
    player2_score: player2Score,
    rating_change: faker.number.int({ min: 8, max: 40 }),
    winner_new_elo: 1200 + faker.number.int({ min: -100, max: 400 }),
    loser_new_elo: 1200 + faker.number.int({ min: -100, max: 400 }),
    k_factor: 32,
    verification_status: 'VERIFIED',
    verified_by: null,
    verified_at: faker.date.recent(),
    created_at: faker.date.recent(),
    updated_at: new Date(),
    ...overrides
  };
};

/**
 * Create a leaderboard entry with realistic data
 */
export const createLeaderboardEntryFactory = (overrides: LeaderboardEntryFactory = {}) => {
  const wins = faker.number.int({ min: 0, max: 300 });
  const losses = faker.number.int({ min: 0, max: 300 });
  const draws = faker.number.int({ min: 0, max: 50 });
  const matches_played = wins + losses + draws;
  const win_rate = matches_played > 0 ? wins / matches_played : 0;

  return {
    id: faker.string.uuid(),
    player_id: faker.string.uuid(),
    rank: faker.number.int({ min: 1, max: 10000 }),
    previous_rank: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 10000 }), { probability: 0.8 }),
    rank_change: faker.number.int({ min: -100, max: 100 }),
    elo_rating: faker.number.int({ min: 800, max: 2400 }),
    previous_elo: faker.helpers.maybe(() => faker.number.int({ min: 800, max: 2400 }), { probability: 0.8 }),
    peak_elo: faker.number.int({ min: 1200, max: 2600 }),
    lowest_elo: faker.number.int({ min: 600, max: 1200 }),
    matches_played,
    wins,
    losses,
    draws,
    win_rate,
    current_streak: faker.number.int({ min: -10, max: 10 }),
    best_win_streak: faker.number.int({ min: 0, max: 20 }),
    season_id: faker.helpers.maybe(() => `season-${faker.number.int({ min: 1, max: 10 })}`, { probability: 0.5 }),
    leaderboard_type: faker.helpers.arrayElement(['GLOBAL', 'SEASONAL', 'WEEKLY', 'MONTHLY', 'REGIONAL']),
    is_active: true,
    last_match_at: faker.date.recent({ days: 7 }),
    last_updated: new Date(),
    created_at: faker.date.past({ years: 1 }),
    ...overrides
  };
};

/**
 * Create multiple players
 */
export const createPlayersFactory = (count: number, overrides: PlayerFactory = {}) => {
  return Array.from({ length: count }, () => createPlayerFactory(overrides));
};

/**
 * Create multiple matches
 */
export const createMatchesFactory = (count: number, overrides: MatchFactory = {}) => {
  return Array.from({ length: count }, () => createMatchFactory(overrides));
};

/**
 * Create multiple match results
 */
export const createMatchResultsFactory = (count: number, overrides: MatchResultFactory = {}) => {
  return Array.from({ length: count }, () => createMatchResultFactory(overrides));
};

/**
 * Create multiple leaderboard entries
 */
export const createLeaderboardEntriesFactory = (count: number, overrides: LeaderboardEntryFactory = {}) => {
  const entries = Array.from({ length: count }, (_, index) =>
    createLeaderboardEntryFactory({ ...overrides, rank: index + 1 })
  );

  // Sort by ELO rating descending
  return entries.sort((a, b) => b.elo_rating - a.elo_rating);
};

/**
 * Create a complete match with result
 */
export const createCompleteMatchFactory = (player1_id: string, player2_id: string) => {
  const match = createMatchFactory({ player1_id, player2_id });
  const result = createMatchResultFactory({
    match_id: match.id,
    winner_id: player1_id,
    loser_id: player2_id
  });

  return { match, result };
};
