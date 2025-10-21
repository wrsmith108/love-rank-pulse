import { matchService } from '../../services/MatchService';
import { Match, MatchResult, MatchStatus, GameMode } from '../../models';
import { generateMatch, generateMatchResult } from '../utils/testDataGenerators';

describe('MatchService', () => {
  // Sample data for tests
  let mockMatches: Match[];
  let mockMatchResults: Map<string, MatchResult[]>;
  
  beforeEach(() => {
    // Generate mock data
    mockMatches = Array.from({ length: 5 }, () => generateMatch());
    mockMatchResults = new Map();
    
    // Generate match results for each match
    mockMatches.forEach(match => {
      const results = Array.from({ length: 10 }, (_, i) => 
        generateMatchResult(match.id, `player-${i}`)
      );
      mockMatchResults.set(match.id, results);
    });
    
    // Initialize service with mock data
    matchService.initializeMockData(mockMatches, mockMatchResults);
  });
  
  describe('Match retrieval', () => {
    test('getMatchById should return a match by ID', () => {
      const match = mockMatches[0];
      const result = matchService.getMatchById(match.id);
      expect(result).toEqual(match);
    });
    
    test('getMatchById should return undefined for non-existent ID', () => {
      const result = matchService.getMatchById('non-existent-id');
      expect(result).toBeUndefined();
    });
    
    test('getAllMatches should return all matches', () => {
      const result = matchService.getAllMatches();
      expect(result).toHaveLength(mockMatches.length);
      expect(result).toEqual(expect.arrayContaining(mockMatches));
    });
    
    test('getActiveMatches should return matches in progress', () => {
      // Create an active match
      const activeMatch = {
        ...generateMatch(),
        status: MatchStatus.IN_PROGRESS
      };
      matchService.createMatch(activeMatch);
      
      const result = matchService.getActiveMatches();
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContainEqual(activeMatch);
    });
    
    test('getMatchesByStatus should filter matches by status', () => {
      const completedMatches = matchService.getMatchesByStatus(MatchStatus.COMPLETED);
      expect(completedMatches.every(match => match.status === MatchStatus.COMPLETED)).toBe(true);
      
      const pendingMatches = matchService.getMatchesByStatus(MatchStatus.PENDING);
      expect(pendingMatches.every(match => match.status === MatchStatus.PENDING)).toBe(true);
    });
    
    test('getMatchesByGameMode should filter matches by game mode', () => {
      const deathmatchMatches = matchService.getMatchesByGameMode(GameMode.DEATHMATCH);
      expect(deathmatchMatches.every(match => match.gameMode === GameMode.DEATHMATCH)).toBe(true);
      
      const captureTheFlagMatches = matchService.getMatchesByGameMode(GameMode.CAPTURE_THE_FLAG);
      expect(captureTheFlagMatches.every(match => match.gameMode === GameMode.CAPTURE_THE_FLAG)).toBe(true);
    });
    
    test('getMatchesByMap should filter matches by map name', () => {
      const match = mockMatches[0];
      const result = matchService.getMatchesByMap(match.mapName);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(m => m.mapName === match.mapName)).toBe(true);
    });
    
    test('getMatchesByTimePeriod should filter matches by time period', () => {
      const startTime = new Date(2023, 0, 1);
      const endTime = new Date(2023, 11, 31);
      
      const result = matchService.getMatchesByTimePeriod(startTime, endTime);
      expect(result.every(match => 
        match.startTime >= startTime && 
        (match.endTime ? match.endTime <= endTime : match.startTime <= endTime)
      )).toBe(true);
    });
  });
  
  describe('Match results', () => {
    test('getMatchResults should return results for a match', () => {
      const match = mockMatches[0];
      const expectedResults = mockMatchResults.get(match.id);
      
      const results = matchService.getMatchResults(match.id);
      expect(results).toEqual(expectedResults);
    });
    
    test('getPlayerMatchResults should return results for a player', () => {
      const playerId = 'player-0';
      const results = matchService.getPlayerMatchResults(playerId);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(result => result.playerId === playerId)).toBe(true);
    });
    
    test('getRecentPlayerMatches should return recent matches for a player', () => {
      const playerId = 'player-0';
      const limit = 3;
      
      const results = matchService.getRecentPlayerMatches(playerId, limit);
      expect(results.length).toBeLessThanOrEqual(limit);
      
      // Check if sorted by start time (most recent first)
      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].startTime.getTime()).toBeGreaterThanOrEqual(results[i].startTime.getTime());
      }
    });
  });
  
  describe('Match management', () => {
    test('createMatch should add a new match', () => {
      const newMatch = generateMatch();
      const result = matchService.createMatch(newMatch);
      
      expect(result).toEqual(newMatch);
      expect(matchService.getMatchById(newMatch.id)).toEqual(newMatch);
    });
    
    test('updateMatch should modify match data', () => {
      const match = mockMatches[0];
      const updates = { mapName: 'Updated Map' };
      
      const result = matchService.updateMatch(match.id, updates);
      expect(result).toMatchObject(updates);
    });
    
    test('startMatch should update match status and start time', () => {
      const match = {
        ...generateMatch(),
        status: MatchStatus.PENDING
      };
      matchService.createMatch(match);
      
      const result = matchService.startMatch(match.id);
      expect(result?.status).toBe(MatchStatus.IN_PROGRESS);
      expect(result?.startTime).toBeDefined();
    });
    
    test('endMatch should update match status, end time, and duration', () => {
      const match = {
        ...generateMatch(),
        status: MatchStatus.IN_PROGRESS
      };
      matchService.createMatch(match);
      
      const winningTeam = 'red';
      const mvpPlayerId = 'player-0';
      
      const result = matchService.endMatch(match.id, winningTeam, mvpPlayerId);
      expect(result?.status).toBe(MatchStatus.COMPLETED);
      expect(result?.endTime).toBeDefined();
      expect(result?.duration).toBeDefined();
      expect(result?.winningTeam).toBe(winningTeam);
      expect(result?.mvpPlayerId).toBe(mvpPlayerId);
    });
  });
  
  describe('Match result management', () => {
    test('addMatchResult should add a result to a match', () => {
      const match = mockMatches[0];
      const newResult = generateMatchResult(match.id, 'new-player');
      
      const result = matchService.addMatchResult(newResult);
      expect(result).toEqual(newResult);
      
      const matchResults = matchService.getMatchResults(match.id);
      expect(matchResults).toContainEqual(newResult);
    });
    
    test('addMatchResults should add multiple results to a match', () => {
      const match = generateMatch();
      matchService.createMatch(match);
      
      const newResults = Array.from({ length: 5 }, (_, i) => 
        generateMatchResult(match.id, `new-player-${i}`)
      );
      
      const result = matchService.addMatchResults(match.id, newResults);
      expect(result).toEqual(newResults);
      
      const matchResults = matchService.getMatchResults(match.id);
      expect(matchResults).toEqual(newResults);
    });
    
    test('updateMatchResult should modify a match result', () => {
      const match = mockMatches[0];
      const matchResult = mockMatchResults.get(match.id)![0];
      
      const updates = { kills: 100, deaths: 50 };
      const result = matchService.updateMatchResult(matchResult.id, match.id, updates);
      
      expect(result).toMatchObject(updates);
    });
  });
  
  // Performance benchmarks
  describe('Performance', () => {
    test('getMatchById should respond in under 5ms', () => {
      const match = mockMatches[0];
      
      const start = performance.now();
      matchService.getMatchById(match.id);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(5);
    });
    
    test('getAllMatches should respond in under 10ms with 100 matches', () => {
      // Generate 100 matches
      const largeMockMatches = Array.from({ length: 100 }, () => generateMatch());
      const largeMockMatchResults = new Map();
      
      // Initialize with large dataset
      matchService.initializeMockData(largeMockMatches, largeMockMatchResults);
      
      const start = performance.now();
      matchService.getAllMatches();
      const end = performance.now();
      
      expect(end - start).toBeLessThan(10);
    });
    
    test('getMatchResults should respond in under 5ms', () => {
      const match = mockMatches[0];
      
      const start = performance.now();
      matchService.getMatchResults(match.id);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(5);
    });
  });
});