import { processRequest, clearCache, apiGateway } from '../../api-gateway';
import { playerService } from '../../services/PlayerService';
import { matchService } from '../../services/MatchService';
import { leaderboardService } from '../../services/LeaderboardService';
import { generatePlayer, generateMatch, generatePlayerStats } from '../utils/testDataGenerators';
import { Player, RegistrationData, LoginCredentials } from '../../models';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('API Gateway Integration', () => {
  // Initialize services with mock data
  beforeAll(() => {
    // Initialize player service
    const mockPlayers = Array.from({ length: 5 }, () => generatePlayer());
    const mockPlayerStats = mockPlayers.map(player => generatePlayerStats(player.id));
    playerService.initializeMockData(mockPlayers, mockPlayerStats);
    
    // Initialize match service
    const mockMatches = Array.from({ length: 5 }, () => generateMatch());
    const mockMatchResults = new Map();
    matchService.initializeMockData(mockMatches, mockMatchResults);
  });
  
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Clear API Gateway cache
    clearCache();
  });
  
  describe('Authentication', () => {
    test('should register a new user through the API Gateway', async () => {
      const registrationData: RegistrationData = {
        username: 'testuser',
        email: 'testuser@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      const response = await processRequest(
        '/auth/register',
        'POST',
        {},
        {},
        registrationData
      );
      
      console.log('Registration response:', JSON.stringify(response, null, 2));
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.user).toBeDefined();
      expect(response.data.token).toBeDefined();
      expect(response.data.user.username).toBe(registrationData.username);
      expect(response.data.user.email).toBe(registrationData.email);
    });
    
    test('should login a user through the API Gateway', async () => {
      // First register a user
      const registrationData: RegistrationData = {
        username: 'logintest',
        email: 'logintest@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      await processRequest(
        '/auth/register',
        'POST',
        {},
        {},
        registrationData
      );
      
      // Then try to log in
      const loginCredentials: LoginCredentials = {
        email: registrationData.email,
        password: registrationData.password
      };
      
      const response = await processRequest(
        '/auth/login',
        'POST',
        {},
        {},
        loginCredentials
      );
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.user).toBeDefined();
      expect(response.data.token).toBeDefined();
      expect(response.data.user.email).toBe(loginCredentials.email);
    });
    
    test('should get current user through the API Gateway', async () => {
      // First register a user
      const registrationData: RegistrationData = {
        username: 'currentuser',
        email: 'currentuser@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      const registerResponse = await processRequest(
        '/auth/register',
        'POST',
        {},
        {},
        registrationData
      );
      
      // Set token in localStorage
      localStorage.setItem('love-rank-pulse-token', registerResponse.data.token);
      
      // Get current user
      const response = await processRequest(
        '/auth/me',
        'GET',
        {},
        { authorization: `Bearer ${registerResponse.data.token}` }
      );
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.id).toBe(registerResponse.data.user.id);
      expect(response.data.username).toBe(registrationData.username);
      expect(response.data.email).toBe(registrationData.email);
    });
    
    test('should logout a user through the API Gateway', async () => {
      // First register a user
      const registrationData: RegistrationData = {
        username: 'logouttest',
        email: 'logouttest@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      const registerResponse = await processRequest(
        '/auth/register',
        'POST',
        {},
        {},
        registrationData
      );
      
      // Set token in localStorage
      localStorage.setItem('love-rank-pulse-token', registerResponse.data.token);
      
      // Logout
      const response = await processRequest(
        '/auth/logout',
        'POST',
        {},
        { authorization: `Bearer ${registerResponse.data.token}` }
      );
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.success).toBe(true);
    });
  });
  
  describe('Player operations', () => {
    test('should get a player by ID through the API Gateway', async () => {
      // First register a user
      const registrationData: RegistrationData = {
        username: 'playertest',
        email: 'playertest@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      const registerResponse = await processRequest(
        '/auth/register',
        'POST',
        {},
        {},
        registrationData
      );
      
      const playerId = registerResponse.data.user.id;
      
      // Set token in localStorage
      localStorage.setItem('love-rank-pulse-token', registerResponse.data.token);
      
      // Get player by ID
      const response = await processRequest(
        `/players/${playerId}`,
        'GET',
        { id: playerId },
        { authorization: `Bearer ${registerResponse.data.token}` }
      );
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.id).toBe(playerId);
      expect(response.data.username).toBe(registrationData.username);
      expect(response.data.email).toBe(registrationData.email);
    });
    
    // Add more tests for player operations...
  });
  
  describe('Match operations', () => {
    test('should get all matches through the API Gateway', async () => {
      // First register a user
      const registrationData: RegistrationData = {
        username: 'matchtest',
        email: 'matchtest@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      const registerResponse = await processRequest(
        '/auth/register',
        'POST',
        {},
        {},
        registrationData
      );
      
      // Set token in localStorage
      localStorage.setItem('love-rank-pulse-token', registerResponse.data.token);
      
      // Get all matches
      const response = await processRequest(
        '/matches',
        'GET',
        {},
        { authorization: `Bearer ${registerResponse.data.token}` }
      );
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
    });
    
    // Add more tests for match operations...
  });
  
  describe('Leaderboard operations', () => {
    test('should get all leaderboards through the API Gateway', async () => {
      // First register a user
      const registrationData: RegistrationData = {
        username: 'leaderboardtest',
        email: 'leaderboardtest@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      const registerResponse = await processRequest(
        '/auth/register',
        'POST',
        {},
        {},
        registrationData
      );
      
      // Set token in localStorage
      localStorage.setItem('love-rank-pulse-token', registerResponse.data.token);
      
      // Get all leaderboards
      const response = await processRequest(
        '/leaderboards',
        'GET',
        {},
        { authorization: `Bearer ${registerResponse.data.token}` }
      );
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
    });
    
    // Add more tests for leaderboard operations...
  });
  
  describe('Caching', () => {
    test('should cache GET requests', async () => {
      // First register a user
      const registrationData: RegistrationData = {
        username: 'cachetest',
        email: 'cachetest@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      const registerResponse = await processRequest(
        '/auth/register',
        'POST',
        {},
        {},
        registrationData
      );
      
      // Set token in localStorage
      localStorage.setItem('love-rank-pulse-token', registerResponse.data.token);
      
      // Spy on apiGateway.handleRequest
      const handleRequestSpy = jest.spyOn(apiGateway, 'handleRequest');
      
      // First request should call handleRequest
      await processRequest(
        '/players',
        'GET',
        {},
        { authorization: `Bearer ${registerResponse.data.token}` }
      );
      
      expect(handleRequestSpy).toHaveBeenCalledTimes(1);
      
      // Reset the spy
      handleRequestSpy.mockClear();
      
      // Second request should use cache
      await processRequest(
        '/players',
        'GET',
        {},
        { authorization: `Bearer ${registerResponse.data.token}` }
      );
      
      // Should not call handleRequest again
      expect(handleRequestSpy).not.toHaveBeenCalled();
      
      // Clean up
      handleRequestSpy.mockRestore();
    });
    
    test('should clear cache when requested', async () => {
      // First register a user
      const registrationData: RegistrationData = {
        username: 'clearcachetest',
        email: 'clearcachetest@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      const registerResponse = await processRequest(
        '/auth/register',
        'POST',
        {},
        {},
        registrationData
      );
      
      // Set token in localStorage
      localStorage.setItem('love-rank-pulse-token', registerResponse.data.token);
      
      // Spy on apiGateway.handleRequest
      const handleRequestSpy = jest.spyOn(apiGateway, 'handleRequest');
      
      // First request should call handleRequest
      await processRequest(
        '/players',
        'GET',
        {},
        { authorization: `Bearer ${registerResponse.data.token}` }
      );
      
      expect(handleRequestSpy).toHaveBeenCalledTimes(1);
      
      // Clear cache
      clearCache();
      
      // Reset the spy
      handleRequestSpy.mockClear();
      
      // Second request should call handleRequest again
      await processRequest(
        '/players',
        'GET',
        {},
        { authorization: `Bearer ${registerResponse.data.token}` }
      );
      
      // Should call handleRequest again
      expect(handleRequestSpy).toHaveBeenCalledTimes(1);
      
      // Clean up
      handleRequestSpy.mockRestore();
    });
  });
  
  // Performance benchmarks
  describe('Performance', () => {
    test('API Gateway should process requests in under 500ms', async () => {
      // First register a user
      const registrationData: RegistrationData = {
        username: 'perftest',
        email: 'perftest@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      const registerResponse = await processRequest(
        '/auth/register',
        'POST',
        {},
        {},
        registrationData
      );
      
      // Set token in localStorage
      localStorage.setItem('love-rank-pulse-token', registerResponse.data.token);
      
      // Measure performance for GET request
      const start = performance.now();
      
      await processRequest(
        '/players',
        'GET',
        {},
        { authorization: `Bearer ${registerResponse.data.token}` }
      );
      
      const end = performance.now();
      
      expect(end - start).toBeLessThan(500);
    });
    
    test('API Gateway should handle 10 concurrent requests efficiently', async () => {
      // First register a user
      const registrationData: RegistrationData = {
        username: 'concurrenttest',
        email: 'concurrenttest@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      const registerResponse = await processRequest(
        '/auth/register',
        'POST',
        {},
        {},
        registrationData
      );
      
      // Set token in localStorage
      localStorage.setItem('love-rank-pulse-token', registerResponse.data.token);
      
      // Measure performance for 10 concurrent requests
      const start = performance.now();
      
      const requests = Array.from({ length: 10 }, () => 
        processRequest(
          '/players',
          'GET',
          {},
          { authorization: `Bearer ${registerResponse.data.token}` }
        )
      );
      
      await Promise.all(requests);
      
      const end = performance.now();
      
      // Average time per request should be less than 100ms
      const averageTime = (end - start) / 10;
      expect(averageTime).toBeLessThan(100);
    });
  });
});