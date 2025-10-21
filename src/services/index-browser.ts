/**
 * Browser-safe service exports for frontend
 * This file prevents importing server-side code in the browser build
 */

// For browser builds, these services should make API calls instead of direct database access
// This is a stub to prevent build errors - the actual implementation should use fetch/axios

export const playerService = {
  login: async () => { throw new Error('Use API client instead'); },
  register: async () => { throw new Error('Use API client instead'); },
  getProfile: async () => { throw new Error('Use API client instead'); },
};

export const matchService = {
  createMatch: async () => { throw new Error('Use API client instead'); },
  getMatches: async () => { throw new Error('Use API client instead'); },
};

export const leaderboardService = {
  getLeaderboard: async () => { throw new Error('Use API client instead'); },
};
