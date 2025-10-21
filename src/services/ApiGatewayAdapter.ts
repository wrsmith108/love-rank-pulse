import { processRequest, clearCache, ApiResponse } from '../api-gateway';
import { Player, PlayerStats, Match, MatchResult, Leaderboard, LeaderboardEntry } from '../models';
import { RegistrationData, LoginCredentials, AuthResponse } from '../models';

/**
 * API Gateway Adapter
 * 
 * Provides a consistent interface for frontend components to interact with
 * the API Gateway, abstracting away the details of request processing.
 */

// Helper function to get authorization headers
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('love-rank-pulse-token');
  return token ? { 'authorization': `Bearer ${token}` } : {};
}

/**
 * Player API methods
 */
export const playerApi = {
  // Authentication
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await processRequest<AuthResponse>(
      '/auth/login',
      'POST',
      {},
      {},
      credentials
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Login failed');
    }
    
    return response.data;
  },
  
  async register(data: RegistrationData): Promise<AuthResponse> {
    const response = await processRequest<AuthResponse>(
      '/auth/register',
      'POST',
      {},
      {},
      data
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Registration failed');
    }
    
    return response.data;
  },
  
  async logout(): Promise<boolean> {
    const response = await processRequest<{ success: boolean }>(
      '/auth/logout',
      'POST',
      {},
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Logout failed');
    }
    
    return response.data.success;
  },
  
  async getCurrentUser(): Promise<Player | null> {
    try {
      const response = await processRequest<Player>(
        '/auth/me',
        'GET',
        {},
        getAuthHeaders()
      );
      
      if (!response.success || !response.data) {
        return null;
      }
      
      return response.data;
    } catch (error) {
      return null;
    }
  },
  
  // Player profile
  async getPlayerById(playerId: string): Promise<Player> {
    const response = await processRequest<Player>(
      `/players/${playerId}`,
      'GET',
      { id: playerId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get player');
    }
    
    return response.data;
  },
  
  async getAllPlayers(): Promise<Player[]> {
    const response = await processRequest<Player[]>(
      '/players',
      'GET',
      {},
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get players');
    }
    
    return response.data;
  },
  
  async searchPlayers(query: string): Promise<Player[]> {
    const response = await processRequest<Player[]>(
      '/players',
      'GET',
      {},
      getAuthHeaders(),
      undefined,
      { q: query }
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to search players');
    }
    
    return response.data;
  },
  
  async getPlayersByCountry(countryCode: string): Promise<Player[]> {
    const response = await processRequest<Player[]>(
      '/players',
      'GET',
      {},
      getAuthHeaders(),
      undefined,
      { countryCode }
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get players by country');
    }
    
    return response.data;
  },
  
  async updatePlayer(playerId: string, updates: Partial<Player>): Promise<Player> {
    const response = await processRequest<Player>(
      `/players/${playerId}`,
      'PUT',
      { id: playerId },
      getAuthHeaders(),
      updates
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update player');
    }
    
    return response.data;
  },
  
  // Player stats
  async getPlayerStats(playerId: string): Promise<PlayerStats> {
    const response = await processRequest<PlayerStats>(
      `/players/${playerId}/stats`,
      'GET',
      { id: playerId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get player stats');
    }
    
    return response.data;
  },
  
  // Friends
  async getPlayerFriends(playerId: string): Promise<Player[]> {
    const response = await processRequest<Player[]>(
      `/players/${playerId}/friends`,
      'GET',
      { id: playerId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get player friends');
    }
    
    return response.data;
  },
  
  async addFriend(playerId: string, friendId: string): Promise<boolean> {
    const response = await processRequest<{ success: boolean }>(
      `/players/${playerId}/friends/${friendId}`,
      'POST',
      { id: playerId, friendId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to add friend');
    }
    
    return response.data.success;
  },
  
  async removeFriend(playerId: string, friendId: string): Promise<boolean> {
    const response = await processRequest<{ success: boolean }>(
      `/players/${playerId}/friends/${friendId}`,
      'DELETE',
      { id: playerId, friendId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to remove friend');
    }
    
    return response.data.success;
  }
};

/**
 * Match API methods
 */
export const matchApi = {
  async getMatchById(matchId: string): Promise<Match> {
    const response = await processRequest<Match>(
      `/matches/${matchId}`,
      'GET',
      { id: matchId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get match');
    }
    
    return response.data;
  },
  
  async getAllMatches(): Promise<Match[]> {
    const response = await processRequest<Match[]>(
      '/matches',
      'GET',
      {},
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get matches');
    }
    
    return response.data;
  },
  
  async getActiveMatches(): Promise<Match[]> {
    const response = await processRequest<Match[]>(
      '/matches/active',
      'GET',
      {},
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get active matches');
    }
    
    return response.data;
  },
  
  async getMatchResults(matchId: string): Promise<MatchResult[]> {
    const response = await processRequest<MatchResult[]>(
      `/matches/${matchId}/results`,
      'GET',
      { id: matchId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get match results');
    }
    
    return response.data;
  },
  
  async getPlayerMatchResults(playerId: string): Promise<MatchResult[]> {
    const response = await processRequest<MatchResult[]>(
      `/players/${playerId}/match-results`,
      'GET',
      { id: playerId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get player match results');
    }
    
    return response.data;
  },
  
  async getRecentPlayerMatches(playerId: string, limit: number = 10): Promise<Match[]> {
    const response = await processRequest<Match[]>(
      `/players/${playerId}/matches`,
      'GET',
      { id: playerId },
      getAuthHeaders(),
      undefined,
      { limit: limit.toString() }
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get recent player matches');
    }
    
    return response.data;
  },
  
  async createMatch(match: Omit<Match, 'id'>): Promise<Match> {
    const response = await processRequest<Match>(
      '/matches',
      'POST',
      {},
      getAuthHeaders(),
      match
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create match');
    }
    
    return response.data;
  },
  
  async updateMatch(matchId: string, updates: Partial<Match>): Promise<Match> {
    const response = await processRequest<Match>(
      `/matches/${matchId}`,
      'PUT',
      { id: matchId },
      getAuthHeaders(),
      updates
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update match');
    }
    
    return response.data;
  },
  
  async startMatch(matchId: string): Promise<Match> {
    const response = await processRequest<Match>(
      `/matches/${matchId}/start`,
      'POST',
      { id: matchId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to start match');
    }
    
    return response.data;
  },
  
  async endMatch(
    matchId: string, 
    winningTeam?: 'red' | 'blue' | 'none', 
    mvpPlayerId?: string
  ): Promise<Match> {
    const response = await processRequest<Match>(
      `/matches/${matchId}/end`,
      'POST',
      { id: matchId },
      getAuthHeaders(),
      { winningTeam, mvpPlayerId }
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to end match');
    }
    
    return response.data;
  },
  
  async addMatchResult(result: Omit<MatchResult, 'id'>): Promise<MatchResult> {
    const response = await processRequest<MatchResult>(
      `/matches/${result.matchId}/results`,
      'POST',
      { id: result.matchId },
      getAuthHeaders(),
      result
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to add match result');
    }
    
    return response.data;
  }
};

/**
 * Leaderboard API methods
 */
export const leaderboardApi = {
  async getLeaderboardById(leaderboardId: string): Promise<Leaderboard> {
    const response = await processRequest<Leaderboard>(
      `/leaderboards/${leaderboardId}`,
      'GET',
      { id: leaderboardId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get leaderboard');
    }
    
    return response.data;
  },
  
  async getAllLeaderboards(): Promise<Leaderboard[]> {
    const response = await processRequest<Leaderboard[]>(
      '/leaderboards',
      'GET',
      {},
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get leaderboards');
    }
    
    return response.data;
  },
  
  async getCurrentSessionLeaderboard(): Promise<Leaderboard> {
    const response = await processRequest<Leaderboard>(
      '/leaderboards/session/current',
      'GET',
      {},
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get current session leaderboard');
    }
    
    return response.data;
  },
  
  async getGlobalLeaderboard(timePeriod: string): Promise<Leaderboard> {
    const response = await processRequest<Leaderboard>(
      `/leaderboards/global/${timePeriod}`,
      'GET',
      { timePeriod },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get global leaderboard');
    }
    
    return response.data;
  },
  
  async getCountryLeaderboard(countryCode: string, timePeriod: string): Promise<Leaderboard> {
    const response = await processRequest<Leaderboard>(
      `/leaderboards/country/${countryCode}/${timePeriod}`,
      'GET',
      { countryCode, timePeriod },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get country leaderboard');
    }
    
    return response.data;
  },
  
  async getTopPlayers(leaderboardId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    const response = await processRequest<LeaderboardEntry[]>(
      `/leaderboards/${leaderboardId}/top`,
      'GET',
      { id: leaderboardId },
      getAuthHeaders(),
      undefined,
      { limit: limit.toString() }
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get top players');
    }
    
    return response.data;
  },
  
  async getPlayerRank(leaderboardId: string, playerId: string): Promise<number> {
    const response = await processRequest<{ playerId: string; rank: number }>(
      `/leaderboards/${leaderboardId}/rank/${playerId}`,
      'GET',
      { id: leaderboardId, playerId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get player rank');
    }
    
    return response.data.rank;
  },
  
  async getPlayerLeaderboardEntry(leaderboardId: string, playerId: string): Promise<LeaderboardEntry> {
    const response = await processRequest<LeaderboardEntry>(
      `/leaderboards/${leaderboardId}/players/${playerId}`,
      'GET',
      { id: leaderboardId, playerId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get player leaderboard entry');
    }
    
    return response.data;
  },
  
  async getPlayerLeaderboardEntries(playerId: string): Promise<LeaderboardEntry[]> {
    const response = await processRequest<LeaderboardEntry[]>(
      `/players/${playerId}/leaderboard-entries`,
      'GET',
      { id: playerId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get player leaderboard entries');
    }
    
    return response.data;
  },
  
  async getLeaderboardStats(leaderboardId: string): Promise<any> {
    const response = await processRequest<any>(
      `/leaderboards/${leaderboardId}/stats`,
      'GET',
      { id: leaderboardId },
      getAuthHeaders()
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get leaderboard stats');
    }
    
    return response.data;
  },
  
  async filterLeaderboard(
    leaderboardId: string, 
    filter: {
      friendsOnly?: boolean;
      countryCode?: string;
      sortBy?: string;
      sortDirection?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    }
  ): Promise<LeaderboardEntry[]> {
    const response = await processRequest<LeaderboardEntry[]>(
      `/leaderboards/${leaderboardId}/filter`,
      'GET',
      { id: leaderboardId },
      getAuthHeaders(),
      undefined,
      filter as Record<string, any>
    );
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to filter leaderboard');
    }
    
    return response.data;
  }
};

// Cache management
export const apiCache = {
  clearAll: () => clearCache(),
  clearByPath: (path: string) => clearCache(path),
  clearForUser: (userId: string) => clearCache(undefined, userId)
};