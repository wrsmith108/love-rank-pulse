import { playerService } from '../../services/PlayerService';
import { Player, PlayerStats, RegistrationData, LoginCredentials } from '../../models';
import { generatePlayer, generatePlayerStats } from '../utils/testDataGenerators';

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

describe('PlayerService', () => {
  // Sample data for tests
  let mockPlayers: Player[];
  let mockPlayerStats: PlayerStats[];
  
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    
    // Generate mock data
    mockPlayers = Array.from({ length: 5 }, () => generatePlayer());
    mockPlayerStats = mockPlayers.map(player => generatePlayerStats(player.id));
    
    // Initialize service with mock data
    playerService.initializeMockData(mockPlayers, mockPlayerStats);
  });
  
  describe('Player retrieval', () => {
    test('getPlayerById should return a player by ID', () => {
      const player = mockPlayers[0];
      const result = playerService.getPlayerById(player.id);
      expect(result).toEqual(player);
    });
    
    test('getPlayerById should return undefined for non-existent ID', () => {
      const result = playerService.getPlayerById('non-existent-id');
      expect(result).toBeUndefined();
    });
    
    test('getPlayersByIds should return multiple players', () => {
      const playerIds = mockPlayers.slice(0, 2).map(p => p.id);
      const result = playerService.getPlayersByIds(playerIds);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockPlayers[0]);
      expect(result[1]).toEqual(mockPlayers[1]);
    });
    
    test('getAllPlayers should return all players', () => {
      const result = playerService.getAllPlayers();
      expect(result).toHaveLength(mockPlayers.length);
      expect(result).toEqual(expect.arrayContaining(mockPlayers));
    });
    
    test('searchPlayers should find players by username', () => {
      const player = mockPlayers[0];
      const result = playerService.searchPlayers(player.username.substring(0, 3));
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContainEqual(player);
    });
    
    test('getPlayersByCountry should filter players by country', () => {
      const player = mockPlayers[0];
      const result = playerService.getPlayersByCountry(player.countryCode);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContainEqual(player);
    });
  });
  
  describe('Player stats', () => {
    test('getPlayerStats should return stats for a player', () => {
      const player = mockPlayers[0];
      const stats = mockPlayerStats[0];
      const result = playerService.getPlayerStats(player.id);
      expect(result).toEqual(stats);
    });
    
    test('updatePlayerStats should modify player stats', () => {
      const player = mockPlayers[0];
      const updates = { kills: 100, deaths: 50 };
      const result = playerService.updatePlayerStats(player.id, updates);
      expect(result).toMatchObject(updates);
    });
  });
  
  describe('Player management', () => {
    test('addPlayer should add a new player', () => {
      const newPlayer = generatePlayer();
      const result = playerService.addPlayer(newPlayer);
      expect(result).toEqual(newPlayer);
      expect(playerService.getPlayerById(newPlayer.id)).toEqual(newPlayer);
    });
    
    test('updatePlayer should modify player data', () => {
      const player = mockPlayers[0];
      const updates = { displayName: 'Updated Name' };
      const result = playerService.updatePlayer(player.id, updates);
      expect(result).toMatchObject(updates);
    });
  });
  
  describe('Friend management', () => {
    test('addFriend should add a friend to a player', () => {
      const player = mockPlayers[0];
      const friend = mockPlayers[1];
      const result = playerService.addFriend(player.id, friend.id);
      expect(result).toBe(true);
      
      const updatedPlayer = playerService.getPlayerById(player.id);
      expect(updatedPlayer?.friendIds).toContain(friend.id);
    });
    
    test('removeFriend should remove a friend from a player', () => {
      const player = mockPlayers[0];
      const friend = mockPlayers[1];
      
      // First add the friend
      playerService.addFriend(player.id, friend.id);
      
      // Then remove
      const result = playerService.removeFriend(player.id, friend.id);
      expect(result).toBe(true);
      
      const updatedPlayer = playerService.getPlayerById(player.id);
      expect(updatedPlayer?.friendIds).not.toContain(friend.id);
    });
    
    test('getPlayerFriends should return a player\'s friends', () => {
      const player = mockPlayers[0];
      const friend = mockPlayers[1];
      
      // Add friend
      playerService.addFriend(player.id, friend.id);
      
      const result = playerService.getPlayerFriends(player.id);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(friend);
    });
  });
  
  describe('Authentication', () => {
    test('register should create a new user and return auth response', () => {
      const registrationData: RegistrationData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      const result = playerService.register(registrationData);
      
      expect(result.user).toMatchObject({
        username: registrationData.username,
        email: registrationData.email,
        countryCode: registrationData.countryCode
      });
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });
    
    test('register should throw error for duplicate email', () => {
      const existingPlayer = mockPlayers[0];
      const registrationData: RegistrationData = {
        username: 'newuser',
        email: existingPlayer.email,
        password: 'password123',
        countryCode: 'US'
      };
      
      expect(() => {
        playerService.register(registrationData);
      }).toThrow('Email already registered');
    });
    
    test('login should authenticate a user and return auth response', () => {
      // First register a user
      const registrationData: RegistrationData = {
        username: 'logintest',
        email: 'logintest@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      playerService.register(registrationData);
      
      // Then try to log in
      const loginCredentials: LoginCredentials = {
        email: registrationData.email,
        password: registrationData.password
      };
      
      const result = playerService.login(loginCredentials);
      
      expect(result.user).toMatchObject({
        username: registrationData.username,
        email: registrationData.email
      });
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });
    
    test('login should throw error for invalid credentials', () => {
      const loginCredentials: LoginCredentials = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      };
      
      expect(() => {
        playerService.login(loginCredentials);
      }).toThrow('Invalid email or password');
    });
    
    test('logout should clear authentication', () => {
      // First register and login
      const registrationData: RegistrationData = {
        username: 'logouttest',
        email: 'logouttest@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      playerService.register(registrationData);
      
      // Then logout
      const result = playerService.logout();
      expect(result).toBe(true);
      
      // Check authentication status
      expect(playerService.isAuthenticated()).toBe(false);
      expect(playerService.getCurrentUser()).toBeNull();
    });
    
    test('getCurrentUser should return the authenticated user', () => {
      // First register a user
      const registrationData: RegistrationData = {
        username: 'currentuser',
        email: 'currentuser@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      const authResponse = playerService.register(registrationData);
      
      // Get current user
      const currentUser = playerService.getCurrentUser();
      expect(currentUser).not.toBeNull();
      expect(currentUser?.id).toBe(authResponse.user.id);
    });
    
    test('isAuthenticated should return authentication status', () => {
      // Initially not authenticated
      expect(playerService.isAuthenticated()).toBe(false);
      
      // Register to authenticate
      const registrationData: RegistrationData = {
        username: 'authtest',
        email: 'authtest@example.com',
        password: 'password123',
        countryCode: 'US'
      };
      
      playerService.register(registrationData);
      
      // Now should be authenticated
      expect(playerService.isAuthenticated()).toBe(true);
    });
  });
  
  // Performance benchmarks
  describe('Performance', () => {
    test('getPlayerById should respond in under 5ms', () => {
      const player = mockPlayers[0];
      
      const start = performance.now();
      playerService.getPlayerById(player.id);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(5);
    });
    
    test('getAllPlayers should respond in under 10ms with 100 players', () => {
      // Generate 100 players
      const largeMockPlayers = Array.from({ length: 100 }, () => generatePlayer());
      const largeMockPlayerStats = largeMockPlayers.map(player => generatePlayerStats(player.id));
      
      // Initialize with large dataset
      playerService.initializeMockData(largeMockPlayers, largeMockPlayerStats);
      
      const start = performance.now();
      playerService.getAllPlayers();
      const end = performance.now();
      
      expect(end - start).toBeLessThan(10);
    });
    
    test('searchPlayers should respond in under 10ms with 100 players', () => {
      // Generate 100 players
      const largeMockPlayers = Array.from({ length: 100 }, () => generatePlayer());
      const largeMockPlayerStats = largeMockPlayers.map(player => generatePlayerStats(player.id));
      
      // Initialize with large dataset
      playerService.initializeMockData(largeMockPlayers, largeMockPlayerStats);
      
      const start = performance.now();
      playerService.searchPlayers(largeMockPlayers[0].username.substring(0, 3));
      const end = performance.now();
      
      expect(end - start).toBeLessThan(10);
    });
  });
});