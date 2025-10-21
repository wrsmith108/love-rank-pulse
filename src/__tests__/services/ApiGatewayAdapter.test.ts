import { playerApi, matchApi, leaderboardApi } from '../../services/ApiGatewayAdapter';
import { processRequest, clearCache } from '../../api-gateway';
import { 
  Player, 
  Match, 
  Leaderboard, 
  RegistrationData, 
  LoginCredentials 
} from '../../models';
import { generatePlayer, generateMatch } from '../utils/testDataGenerators';

// Mock the api-gateway module
jest.mock('../../api-gateway', () => ({
  processRequest: jest.fn(),
  clearCache: jest.fn(),
  apiGateway: {
    handleRequest: jest.fn()
  }
}));

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

describe('ApiGatewayAdapter', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });
  
  describe('playerApi', () => {
    describe('Authentication', () => {
      test('login should call processRequest with correct parameters', async () => {
        // Mock successful response
        const mockResponse = {
          success: true,
          data: {
            user: generatePlayer(),
            token: 'mock-token',
            expiresAt: new Date()
          }
        };
        
        (processRequest as jest.Mock).mockResolvedValue(mockResponse);
        
        const credentials: LoginCredentials = {
          email: 'test@example.com',
          password: 'password123'
        };
        
        const result = await playerApi.login(credentials);
        
        expect(processRequest).toHaveBeenCalledWith(
          '/auth/login',
          'POST',
          {},
          {},
          credentials
        );
        
        expect(result).toEqual(mockResponse.data);
      });
      
      test('login should throw error on failed response', async () => {
        // Mock failed response
        const mockResponse = {
          success: false,
          error: 'Invalid credentials'
        };
        
        (processRequest as jest.Mock).mockResolvedValue(mockResponse);
        
        const credentials: LoginCredentials = {
          email: 'test@example.com',
          password: 'wrong-password'
        };
        
        await expect(playerApi.login(credentials)).rejects.toThrow('Invalid credentials');
      });
      
      test('register should call processRequest with correct parameters', async () => {
        // Mock successful response
        const mockResponse = {
          success: true,
          data: {
            user: generatePlayer(),
            token: 'mock-token',
            expiresAt: new Date()
          }
        };
        
        (processRequest as jest.Mock).mockResolvedValue(mockResponse);
        
        const registrationData: RegistrationData = {
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'password123',
          countryCode: 'US'
        };
        
        const result = await playerApi.register(registrationData);
        
        expect(processRequest).toHaveBeenCalledWith(
          '/auth/register',
          'POST',
          {},
          {},
          registrationData
        );
        
        expect(result).toEqual(mockResponse.data);
      });
      
      test('logout should call processRequest with correct parameters', async () => {
        // Set auth token in localStorage
        localStorage.setItem('love-rank-pulse-token', 'mock-token');
        
        // Mock successful response
        const mockResponse = {
          success: true,
          data: { success: true }
        };
        
        (processRequest as jest.Mock).mockResolvedValue(mockResponse);
        
        const result = await playerApi.logout();
        
        expect(processRequest).toHaveBeenCalledWith(
          '/auth/logout',
          'POST',
          {},
          { authorization: 'Bearer mock-token' }
        );
        
        expect(result).toBe(true);
      });
      
      test('getCurrentUser should call processRequest with correct parameters', async () => {
        // Set auth token in localStorage
        localStorage.setItem('love-rank-pulse-token', 'mock-token');
        
        // Mock successful response
        const mockPlayer = generatePlayer();
        const mockResponse = {
          success: true,
          data: mockPlayer
        };
        
        (processRequest as jest.Mock).mockResolvedValue(mockResponse);
        
        const result = await playerApi.getCurrentUser();
        
        expect(processRequest).toHaveBeenCalledWith(
          '/auth/me',
          'GET',
          {},
          { authorization: 'Bearer mock-token' }
        );
        
        expect(result).toEqual(mockPlayer);
      });
      
      test('getCurrentUser should return null on error', async () => {
        // Set auth token in localStorage
        localStorage.setItem('love-rank-pulse-token', 'mock-token');
        
        // Mock error
        (processRequest as jest.Mock).mockRejectedValue(new Error('Network error'));
        
        const result = await playerApi.getCurrentUser();
        
        expect(result).toBeNull();
      });
    });
    
    describe('Player operations', () => {
      test('getPlayerById should call processRequest with correct parameters', async () => {
        // Set auth token in localStorage
        localStorage.setItem('love-rank-pulse-token', 'mock-token');
        
        // Mock successful response
        const mockPlayer = generatePlayer();
        const mockResponse = {
          success: true,
          data: mockPlayer
        };
        
        (processRequest as jest.Mock).mockResolvedValue(mockResponse);
        
        const result = await playerApi.getPlayerById(mockPlayer.id);
        
        expect(processRequest).toHaveBeenCalledWith(
          `/players/${mockPlayer.id}`,
          'GET',
          { id: mockPlayer.id },
          { authorization: 'Bearer mock-token' }
        );
        
        expect(result).toEqual(mockPlayer);
      });
      
      // Add more tests for other player operations...
    });
    
    // Performance benchmarks
    describe('Performance', () => {
      test('getPlayerById should respond in under 500ms', async () => {
        // Set auth token in localStorage
        localStorage.setItem('love-rank-pulse-token', 'mock-token');
        
        // Mock successful response with delay
        const mockPlayer = generatePlayer();
        const mockResponse = {
          success: true,
          data: mockPlayer
        };
        
        (processRequest as jest.Mock).mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve(mockResponse), 50);
          });
        });
        
        const start = performance.now();
        await playerApi.getPlayerById(mockPlayer.id);
        const end = performance.now();
        
        expect(end - start).toBeLessThan(500);
      });
    });
  });
  
  describe('matchApi', () => {
    test('getMatchById should call processRequest with correct parameters', async () => {
      // Set auth token in localStorage
      localStorage.setItem('love-rank-pulse-token', 'mock-token');
      
      // Mock successful response
      const mockMatch = generateMatch();
      const mockResponse = {
        success: true,
        data: mockMatch
      };
      
      (processRequest as jest.Mock).mockResolvedValue(mockResponse);
      
      const result = await matchApi.getMatchById(mockMatch.id);
      
      expect(processRequest).toHaveBeenCalledWith(
        `/matches/${mockMatch.id}`,
        'GET',
        { id: mockMatch.id },
        { authorization: 'Bearer mock-token' }
      );
      
      expect(result).toEqual(mockMatch);
    });
    
    // Add more tests for other match operations...
    
    // Performance benchmarks
    describe('Performance', () => {
      test('getMatchById should respond in under 500ms', async () => {
        // Set auth token in localStorage
        localStorage.setItem('love-rank-pulse-token', 'mock-token');
        
        // Mock successful response with delay
        const mockMatch = generateMatch();
        const mockResponse = {
          success: true,
          data: mockMatch
        };
        
        (processRequest as jest.Mock).mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve(mockResponse), 50);
          });
        });
        
        const start = performance.now();
        await matchApi.getMatchById(mockMatch.id);
        const end = performance.now();
        
        expect(end - start).toBeLessThan(500);
      });
    });
  });
  
  describe('leaderboardApi', () => {
    test('getLeaderboardById should call processRequest with correct parameters', async () => {
      // Set auth token in localStorage
      localStorage.setItem('love-rank-pulse-token', 'mock-token');
      
      // Mock successful response
      const mockLeaderboard = generateLeaderboard();
      const mockResponse = {
        success: true,
        data: mockLeaderboard
      };
      
      (processRequest as jest.Mock).mockResolvedValue(mockResponse);
      
      const result = await leaderboardApi.getLeaderboardById(mockLeaderboard.id);
      
      expect(processRequest).toHaveBeenCalledWith(
        `/leaderboards/${mockLeaderboard.id}`,
        'GET',
        { id: mockLeaderboard.id },
        { authorization: 'Bearer mock-token' }
      );
      
      expect(result).toEqual(mockLeaderboard);
    });
    
    // Add more tests for other leaderboard operations...
    
    // Performance benchmarks
    describe('Performance', () => {
      test('getLeaderboardById should respond in under 500ms', async () => {
        // Set auth token in localStorage
        localStorage.setItem('love-rank-pulse-token', 'mock-token');
        
        // Mock successful response with delay
        const mockLeaderboard = generateLeaderboard();
        const mockResponse = {
          success: true,
          data: mockLeaderboard
        };
        
        (processRequest as jest.Mock).mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve(mockResponse), 50);
          });
        });
        
        const start = performance.now();
        await leaderboardApi.getLeaderboardById(mockLeaderboard.id);
        const end = performance.now();
        
        expect(end - start).toBeLessThan(500);
      });
    });
  });
});

// Helper function to generate a random leaderboard
function generateLeaderboard(): Leaderboard {
  return {
    id: 'test-leaderboard',
    name: 'Test Leaderboard',
    scope: 'global' as any,
    timePeriod: 'all' as any,
    sortBy: 'rank' as any,
    sortDirection: 'asc',
    entries: [],
    totalPlayers: 0,
    lastUpdated: new Date()
  };
}