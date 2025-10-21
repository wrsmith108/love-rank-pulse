import { leaderboardService } from '../../services/LeaderboardService';
import { playerService } from '../../services/PlayerService';
import { matchService } from '../../services/MatchService';
import { 
  Leaderboard, 
  LeaderboardEntry, 
  LeaderboardScope, 
  TimePeriod, 
  SortCriteria 
} from '../../models';
import { 
  generateLeaderboard, 
  generateLeaderboardEntry, 
  generatePlayer 
} from '../utils/testDataGenerators';

describe('LeaderboardService', () => {
  // Sample data for tests
  let mockLeaderboards: Leaderboard[];
  
  beforeEach(() => {
    // Generate mock data
    mockLeaderboards = [
      generateLeaderboard(LeaderboardScope.GLOBAL, TimePeriod.ALL_TIME, 10),
      generateLeaderboard(LeaderboardScope.GLOBAL, TimePeriod.WEEK, 10),
      generateLeaderboard(LeaderboardScope.COUNTRY, TimePeriod.MONTH, 10, { name: 'US Leaderboard - MONTH' }),
      generateLeaderboard(LeaderboardScope.SESSION, TimePeriod.SESSION, 10)
    ];
    
    // Initialize service with mock data
    leaderboardService.initializeMockData(mockLeaderboards);
  });
  
  describe('Leaderboard retrieval', () => {
    test('getLeaderboardById should return a leaderboard by ID', () => {
      const leaderboard = mockLeaderboards[0];
      const result = leaderboardService.getLeaderboardById(leaderboard.id);
      expect(result).toEqual(leaderboard);
    });
    
    test('getLeaderboardById should return undefined for non-existent ID', () => {
      const result = leaderboardService.getLeaderboardById('non-existent-id');
      expect(result).toBeUndefined();
    });
    
    test('getAllLeaderboards should return all leaderboards', () => {
      const result = leaderboardService.getAllLeaderboards();
      expect(result).toHaveLength(mockLeaderboards.length);
      expect(result).toEqual(expect.arrayContaining(mockLeaderboards));
    });
    
    test('getLeaderboardsByScope should filter leaderboards by scope', () => {
      const globalLeaderboards = leaderboardService.getLeaderboardsByScope(LeaderboardScope.GLOBAL);
      expect(globalLeaderboards.length).toBe(2);
      expect(globalLeaderboards.every(lb => lb.scope === LeaderboardScope.GLOBAL)).toBe(true);
      
      const countryLeaderboards = leaderboardService.getLeaderboardsByScope(LeaderboardScope.COUNTRY);
      expect(countryLeaderboards.length).toBe(1);
      expect(countryLeaderboards.every(lb => lb.scope === LeaderboardScope.COUNTRY)).toBe(true);
    });
    
    test('getLeaderboardsByTimePeriod should filter leaderboards by time period', () => {
      const weeklyLeaderboards = leaderboardService.getLeaderboardsByTimePeriod(TimePeriod.WEEK);
      expect(weeklyLeaderboards.length).toBe(1);
      expect(weeklyLeaderboards.every(lb => lb.timePeriod === TimePeriod.WEEK)).toBe(true);
      
      const monthlyLeaderboards = leaderboardService.getLeaderboardsByTimePeriod(TimePeriod.MONTH);
      expect(monthlyLeaderboards.length).toBe(1);
      expect(monthlyLeaderboards.every(lb => lb.timePeriod === TimePeriod.MONTH)).toBe(true);
    });
    
    test('getCurrentSessionLeaderboard should return the current session leaderboard', () => {
      const result = leaderboardService.getCurrentSessionLeaderboard();
      expect(result).toBeDefined();
      expect(result?.scope).toBe(LeaderboardScope.SESSION);
      expect(result?.timePeriod).toBe(TimePeriod.SESSION);
    });
    
    test('getGlobalLeaderboard should return the global leaderboard for a time period', () => {
      const result = leaderboardService.getGlobalLeaderboard(TimePeriod.ALL_TIME);
      expect(result).toBeDefined();
      expect(result?.scope).toBe(LeaderboardScope.GLOBAL);
      expect(result?.timePeriod).toBe(TimePeriod.ALL_TIME);
    });
    
    test('getCountryLeaderboard should return the country leaderboard', () => {
      const result = leaderboardService.getCountryLeaderboard('US', TimePeriod.MONTH);
      expect(result).toBeDefined();
      expect(result?.scope).toBe(LeaderboardScope.COUNTRY);
      expect(result?.timePeriod).toBe(TimePeriod.MONTH);
      expect(result?.name).toContain('US');
    });
  });
  
  describe('Player rankings', () => {
    test('getPlayerRank should return a player\'s rank in a leaderboard', () => {
      const leaderboard = mockLeaderboards[0];
      const entry = leaderboard.entries[0];
      
      const result = leaderboardService.getPlayerRank(leaderboard.id, entry.playerId);
      expect(result).toBe(entry.rank);
    });
    
    test('getPlayerRank should return -1 for a player not in the leaderboard', () => {
      const leaderboard = mockLeaderboards[0];
      const result = leaderboardService.getPlayerRank(leaderboard.id, 'non-existent-player');
      expect(result).toBe(-1);
    });
    
    test('getPlayerLeaderboardEntry should return a player\'s entry in a leaderboard', () => {
      const leaderboard = mockLeaderboards[0];
      const entry = leaderboard.entries[0];
      
      const result = leaderboardService.getPlayerLeaderboardEntry(leaderboard.id, entry.playerId);
      expect(result).toEqual(entry);
    });
    
    test('getPlayerLeaderboardEntries should return a player\'s entries across all leaderboards', () => {
      // Create a player that exists in multiple leaderboards
      const playerId = 'test-player-id';
      const playerName = 'Test Player';
      
      // Add entries for this player to multiple leaderboards
      mockLeaderboards.forEach((leaderboard, index) => {
        const entry = generateLeaderboardEntry(playerId, playerName, index + 1, leaderboard.id);
        leaderboard.entries.push(entry);
      });
      
      leaderboardService.initializeMockData(mockLeaderboards);
      
      const result = leaderboardService.getPlayerLeaderboardEntries(playerId);
      expect(result.length).toBe(mockLeaderboards.length);
      expect(result.every(entry => entry.playerId === playerId)).toBe(true);
    });
  });
  
  describe('Leaderboard operations', () => {
    test('getTopPlayers should return the top players from a leaderboard', () => {
      const leaderboard = mockLeaderboards[0];
      const limit = 5;
      
      const result = leaderboardService.getTopPlayers(leaderboard.id, limit);
      expect(result).toHaveLength(limit);
      expect(result).toEqual(leaderboard.entries.slice(0, limit));
    });
    
    test('filterLeaderboard should filter entries by criteria', () => {
      const leaderboard = mockLeaderboards[0];
      
      // Filter by country
      const countryCode = leaderboard.entries[0].countryCode;
      const result = leaderboardService.filterLeaderboard(leaderboard.id, { countryCode });
      
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(entry => entry.countryCode === countryCode)).toBe(true);
    });
    
    test('sortLeaderboardEntries should sort entries by criteria', () => {
      const entries = mockLeaderboards[0].entries;
      
      // Sort by kills (descending)
      const sortedByKills = leaderboardService.sortLeaderboardEntries(
        entries, 
        SortCriteria.KILLS, 
        'desc'
      );
      
      for (let i = 1; i < sortedByKills.length; i++) {
        expect(sortedByKills[i-1].kills).toBeGreaterThanOrEqual(sortedByKills[i].kills);
      }
      
      // Sort by accuracy (ascending)
      const sortedByAccuracy = leaderboardService.sortLeaderboardEntries(
        entries, 
        SortCriteria.ACCURACY, 
        'asc'
      );
      
      for (let i = 1; i < sortedByAccuracy.length; i++) {
        expect(sortedByAccuracy[i-1].accuracy).toBeLessThanOrEqual(sortedByAccuracy[i].accuracy);
      }
    });
  });
  
  describe('Leaderboard management', () => {
    test('createLeaderboard should add a new leaderboard', () => {
      const newLeaderboard = generateLeaderboard(LeaderboardScope.GLOBAL, TimePeriod.TODAY);
      const result = leaderboardService.createLeaderboard(newLeaderboard);
      
      expect(result).toEqual(newLeaderboard);
      expect(leaderboardService.getLeaderboardById(newLeaderboard.id)).toEqual(newLeaderboard);
    });
    
    test('updateLeaderboard should modify leaderboard data', () => {
      const leaderboard = mockLeaderboards[0];
      const updates = { name: 'Updated Leaderboard' };
      
      const result = leaderboardService.updateLeaderboard(leaderboard.id, updates);
      expect(result).toMatchObject(updates);
    });
    
    test('updateLeaderboardEntries should update the entries in a leaderboard', () => {
      const leaderboard = mockLeaderboards[0];
      const newEntries = Array.from({ length: 5 }, (_, i) => 
        generateLeaderboardEntry(
          `player-${i}`, 
          `Player ${i}`, 
          i + 1, 
          leaderboard.id
        )
      );
      
      const result = leaderboardService.updateLeaderboardEntries(leaderboard.id, newEntries);
      expect(result?.entries).toEqual(newEntries);
    });
  });
  
  describe('Leaderboard statistics', () => {
    test('getLeaderboardStats should return statistics for a leaderboard', () => {
      const leaderboard = mockLeaderboards[0];
      const stats = leaderboardService.getLeaderboardStats(leaderboard.id);
      
      expect(stats).toBeDefined();
      expect(stats?.totalPlayers).toBe(leaderboard.entries.length);
      expect(stats?.averageKdRatio).toBeDefined();
      expect(stats?.averageAccuracy).toBeDefined();
      expect(stats?.averageScore).toBeDefined();
      expect(stats?.topCountries).toBeDefined();
      expect(stats?.topCountries.length).toBeGreaterThan(0);
    });
  });
  
  describe('Leaderboard generation', () => {
    test('generateLeaderboard should create a new leaderboard with the specified parameters', () => {
      const scope = LeaderboardScope.GLOBAL;
      const timePeriod = TimePeriod.TODAY;
      const countryCode = 'FR';
      
      const result = leaderboardService.generateLeaderboard(scope, timePeriod, countryCode);
      
      expect(result).toBeDefined();
      expect(result.scope).toBe(scope);
      expect(result.timePeriod).toBe(timePeriod);
      expect(result.name).toContain(countryCode);
    });
  });
  
  // Performance benchmarks
  describe('Performance', () => {
    test('getLeaderboardById should respond in under 5ms', () => {
      const leaderboard = mockLeaderboards[0];
      
      const start = performance.now();
      leaderboardService.getLeaderboardById(leaderboard.id);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(5);
    });
    
    test('getAllLeaderboards should respond in under 10ms with 20 leaderboards', () => {
      // Generate 20 leaderboards
      const largeMockLeaderboards = Array.from({ length: 20 }, (_, i) => 
        generateLeaderboard(
          i % 2 === 0 ? LeaderboardScope.GLOBAL : LeaderboardScope.COUNTRY,
          i % 4 === 0 ? TimePeriod.TODAY :
          i % 4 === 1 ? TimePeriod.WEEK :
          i % 4 === 2 ? TimePeriod.MONTH :
          TimePeriod.ALL_TIME
        )
      );
      
      // Initialize with large dataset
      leaderboardService.initializeMockData(largeMockLeaderboards);
      
      const start = performance.now();
      leaderboardService.getAllLeaderboards();
      const end = performance.now();
      
      expect(end - start).toBeLessThan(10);
    });
    
    test('filterLeaderboard should respond in under 10ms with 1000 entries', () => {
      // Create a leaderboard with 1000 entries
      const largeLeaderboard = generateLeaderboard(LeaderboardScope.GLOBAL, TimePeriod.ALL_TIME, 1000);
      leaderboardService.createLeaderboard(largeLeaderboard);
      
      const start = performance.now();
      leaderboardService.filterLeaderboard(largeLeaderboard.id, { countryCode: 'US' });
      const end = performance.now();
      
      expect(end - start).toBeLessThan(10);
    });
  });
});