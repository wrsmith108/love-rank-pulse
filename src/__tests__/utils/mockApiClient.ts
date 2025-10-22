/**
 * Mock API Client for testing frontend API integration
 * Provides mock implementations of API calls with configurable responses
 */

import {
  ApiResponse,
  PaginatedApiResponse,
  LeaderboardApi,
  PlayerApi,
  MatchApi
} from '@/types/api';
import { LeaderboardEntry, Player, PlayerStats } from '@/models';

/**
 * Mock API client configuration
 */
export interface MockApiConfig {
  delay?: number; // Simulate network delay
  shouldFail?: boolean; // Force error responses
  errorMessage?: string;
}

/**
 * Mock API response builder
 */
export class MockApiClient {
  private config: MockApiConfig;
  private callHistory: Array<{ endpoint: string; params?: any; timestamp: Date }> = [];

  constructor(config: MockApiConfig = {}) {
    this.config = {
      delay: 0,
      shouldFail: false,
      errorMessage: 'API request failed',
      ...config
    };
  }

  /**
   * Track API call
   */
  private trackCall(endpoint: string, params?: any): void {
    this.callHistory.push({
      endpoint,
      params,
      timestamp: new Date()
    });
  }

  /**
   * Get call history for assertions
   */
  public getCallHistory() {
    return this.callHistory;
  }

  /**
   * Clear call history
   */
  public clearCallHistory(): void {
    this.callHistory = [];
  }

  /**
   * Simulate network delay
   */
  private async simulateDelay(): Promise<void> {
    if (this.config.delay && this.config.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.delay));
    }
  }

  /**
   * Build success response
   */
  private buildSuccessResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Build error response
   */
  private buildErrorResponse(): ApiResponse<any> {
    return {
      success: false,
      error: this.config.errorMessage,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Build paginated response
   */
  private buildPaginatedResponse<T>(
    data: T[],
    page: number = 1,
    pageSize: number = 20
  ): PaginatedApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      pagination: {
        page,
        pageSize,
        totalItems: data.length,
        totalPages: Math.ceil(data.length / pageSize),
        hasMore: page * pageSize < data.length
      }
    };
  }

  /**
   * Mock: Get leaderboard entries
   */
  async getLeaderboard(
    scope: 'global' | 'country' | 'session',
    options?: LeaderboardApi.GetLeaderboardFilterOptions
  ): Promise<LeaderboardApi.GetFilteredLeaderboardResponse> {
    this.trackCall('getLeaderboard', { scope, options });
    await this.simulateDelay();

    if (this.config.shouldFail) {
      throw new Error(this.config.errorMessage);
    }

    const mockEntries: LeaderboardEntry[] = [
      {
        id: '1',
        playerId: 'player-1',
        leaderboardId: 'leaderboard-1',
        playerName: 'ProGamer123',
        countryCode: 'US',
        rank: 1,
        kills: 150,
        deaths: 50,
        kdRatio: 3.0,
        matchesPlayed: 60,
        wins: 45,
        losses: 15,
        winRate: 0.75,
        isOnWinStreak: true,
        currentStreak: 5,
        score: 25000,
        headshots: 75,
        accuracy: 0.82,
        lastPlayed: new Date()
      },
      {
        id: '2',
        playerId: 'player-2',
        leaderboardId: 'leaderboard-1',
        playerName: 'SkillMaster',
        countryCode: 'UK',
        rank: 2,
        kills: 140,
        deaths: 55,
        kdRatio: 2.55,
        matchesPlayed: 60,
        wins: 40,
        losses: 20,
        winRate: 0.67,
        isOnWinStreak: false,
        currentStreak: 0,
        score: 23500,
        headshots: 68,
        accuracy: 0.78,
        lastPlayed: new Date()
      },
      {
        id: '3',
        playerId: 'player-3',
        leaderboardId: 'leaderboard-1',
        playerName: 'EliteSniper',
        countryCode: 'CA',
        rank: 3,
        kills: 130,
        deaths: 60,
        kdRatio: 2.17,
        matchesPlayed: 60,
        wins: 38,
        losses: 22,
        winRate: 0.63,
        isOnWinStreak: false,
        currentStreak: 0,
        score: 22000,
        headshots: 85,
        accuracy: 0.88,
        lastPlayed: new Date()
      }
    ];

    const { LeaderboardScope, TimePeriod, SortCriteria } = require('@/models');

    return {
      ...this.buildPaginatedResponse(mockEntries, options?.page || 1, options?.pageSize || 20),
      filter: {
        scope: scope === 'global' ? LeaderboardScope.GLOBAL : scope === 'country' ? LeaderboardScope.COUNTRY : LeaderboardScope.SESSION,
        timePeriod: options?.timePeriod || TimePeriod.ALL_TIME,
        countryCode: options?.countryCode,
        friendsOnly: options?.friendsOnly || false,
        sortBy: options?.sortBy || SortCriteria.RANK,
        sortDirection: options?.sortDirection || 'asc'
      }
    };
  }

  /**
   * Mock: Get player stats
   */
  async getPlayerStats(playerId: string): Promise<PlayerApi.GetPlayerStatsResponse> {
    this.trackCall('getPlayerStats', { playerId });
    await this.simulateDelay();

    if (this.config.shouldFail) {
      return this.buildErrorResponse();
    }

    const mockStats: PlayerStats = {
      playerId,
      kills: 150,
      deaths: 50,
      assists: 75,
      kdRatio: 3.0,
      headshots: 75,
      accuracy: 0.82,
      wins: 45,
      losses: 15,
      winRate: 0.75,
      matchesPlayed: 60,
      favoriteWeapon: 'AK-47',
      averageScore: 417,
      rank: 42,
      eloRating: 1500
    };

    return this.buildSuccessResponse(mockStats);
  }

  /**
   * Mock: Get player details
   */
  async getPlayer(playerId: string): Promise<PlayerApi.GetPlayerResponse> {
    this.trackCall('getPlayer', { playerId });
    await this.simulateDelay();

    if (this.config.shouldFail) {
      return this.buildErrorResponse();
    }

    const mockPlayer: Player = {
      id: playerId,
      username: 'testuser',
      email: 'test@example.com',
      displayName: 'Test User',
      countryCode: 'US',
      eloRating: 1500,
      rank: 42,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      isActive: true
    };

    return this.buildSuccessResponse(mockPlayer);
  }

  /**
   * Mock: Update player
   */
  async updatePlayer(
    playerId: string,
    updates: PlayerApi.UpdatePlayerRequest
  ): Promise<PlayerApi.UpdatePlayerResponse> {
    this.trackCall('updatePlayer', { playerId, updates });
    await this.simulateDelay();

    if (this.config.shouldFail) {
      return this.buildErrorResponse();
    }

    const mockPlayer: Player = {
      id: playerId,
      username: 'testuser',
      email: 'test@example.com',
      displayName: updates.displayName || 'Test User',
      countryCode: updates.countryCode || 'US',
      eloRating: 1500,
      rank: 42,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      isActive: true
    };

    return this.buildSuccessResponse(mockPlayer);
  }

  /**
   * Mock: Get player rank
   */
  async getPlayerRank(
    playerId: string,
    scope: 'global' | 'country' | 'session'
  ): Promise<LeaderboardApi.GetPlayerRankResponse> {
    this.trackCall('getPlayerRank', { playerId, scope });
    await this.simulateDelay();

    if (this.config.shouldFail) {
      return this.buildErrorResponse();
    }

    return this.buildSuccessResponse({
      playerId,
      rank: 42,
      percentile: 0.95,
      nearbyPlayers: []
    });
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<MockApiConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset to default configuration
   */
  public reset(): void {
    this.config = {
      delay: 0,
      shouldFail: false,
      errorMessage: 'API request failed'
    };
    this.clearCallHistory();
  }
}

/**
 * Create a mock API client instance
 */
export function createMockApiClient(config?: MockApiConfig): MockApiClient {
  return new MockApiClient(config);
}

/**
 * Mock fetch for testing
 */
export function mockFetch(response: any, shouldFail: boolean = false) {
  return jest.fn().mockImplementation(() => {
    if (shouldFail) {
      return Promise.reject(new Error('Network error'));
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(response)
    });
  });
}

/**
 * Mock axios for testing
 */
export function mockAxios() {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn()
  };
}
