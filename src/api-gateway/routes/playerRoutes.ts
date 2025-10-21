import { RouteDefinition } from '../ApiGateway';
import { playerService } from '../../services';
import { ApiResponse } from '../types/api';
import { Player, PlayerStats, RegistrationData, LoginCredentials } from '../../models';
import { ApiErrors } from '../middleware/errorMiddleware';
import { withErrorHandling } from '../middleware/errorMiddleware';
import { RequestContext } from '../ApiGateway';

/**
 * Player API Routes
 * 
 * Defines routes for player-related operations:
 * - Authentication (login, register, logout)
 * - Player profile management
 * - Player statistics
 * - Friend management
 */

// Authentication Routes
const authRoutes: RouteDefinition[] = [
  {
    path: '/auth/login',
    method: 'POST',
    requiresAuth: false,
    cacheEnabled: false,
    handler: withErrorHandling(async (context: RequestContext) => {
      const credentials = context.body as LoginCredentials;
      
      if (!credentials || !credentials.email || !credentials.password) {
        throw ApiErrors.BadRequest('Email and password are required');
      }
      
      try {
        const authResponse = await playerService.login(credentials);
        return authResponse;
      } catch (error) {
        throw ApiErrors.Unauthorized(error instanceof Error ? error.message : 'Invalid credentials');
      }
    })
  },
  {
    path: '/auth/register',
    method: 'POST',
    requiresAuth: false,
    cacheEnabled: false,
    handler: withErrorHandling(async (context: RequestContext) => {
      const registrationData = context.body as RegistrationData;
      
      console.log('Registration handler received:', {
        contextBody: context.body,
        registrationData,
        hasEmail: !!registrationData?.email,
        hasPassword: !!registrationData?.password,
        hasUsername: !!registrationData?.username,
        hasCountryCode: !!registrationData?.countryCode
      });
      
      if (!registrationData || !registrationData.email || !registrationData.password ||
          !registrationData.username || !registrationData.countryCode) {
        throw ApiErrors.BadRequest('All registration fields are required');
      }
      
      try {
        const authResponse = await playerService.register(registrationData);
        return authResponse;
      } catch (error) {
        throw ApiErrors.BadRequest(error instanceof Error ? error.message : 'Registration failed');
      }
    })
  },
  {
    path: '/auth/logout',
    method: 'POST',
    requiresAuth: true,
    cacheEnabled: false,
    handler: withErrorHandling((context: RequestContext) => {
      if (!context.userId) {
        throw ApiErrors.Unauthorized();
      }
      
      const success = playerService.logout();
      
      if (!success) {
        throw ApiErrors.InternalError('Logout failed');
      }
      
      return { success: true };
    })
  },
  {
    path: '/auth/me',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    cacheTTL: 60, // 1 minute
    handler: withErrorHandling((context: RequestContext) => {
      if (!context.userId) {
        throw ApiErrors.Unauthorized();
      }
      
      const currentUser = playerService.getCurrentUser();
      
      if (!currentUser) {
        throw ApiErrors.NotFound('User profile');
      }
      
      return currentUser;
    })
  }
];

// Player Profile Routes
const playerProfileRoutes: RouteDefinition[] = [
  {
    path: '/players/:id',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const playerId = context.params.id;
      
      if (!playerId) {
        throw ApiErrors.BadRequest('Player ID is required');
      }
      
      const player = playerService.getPlayerById(playerId);
      
      if (!player) {
        throw ApiErrors.NotFound('Player', playerId);
      }
      
      return player;
    })
  },
  {
    path: '/players',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      // Get query parameters for filtering
      const countryCode = context.query?.countryCode as string;
      const searchQuery = context.query?.q as string;
      
      let players: Player[];
      
      if (searchQuery) {
        // Search players by username or display name
        players = playerService.searchPlayers(searchQuery);
      } else if (countryCode) {
        // Filter players by country
        players = playerService.getPlayersByCountry(countryCode);
      } else {
        // Get all players
        players = playerService.getAllPlayers();
      }
      
      return players;
    })
  },
  {
    path: '/players/:id',
    method: 'PUT',
    requiresAuth: true,
    cacheEnabled: false,
    handler: withErrorHandling((context: RequestContext) => {
      const playerId = context.params.id;
      const updates = context.body;
      
      if (!playerId) {
        throw ApiErrors.BadRequest('Player ID is required');
      }
      
      // Check if user is updating their own profile
      if (context.userId !== playerId) {
        throw ApiErrors.Forbidden('You can only update your own profile');
      }
      
      const updatedPlayer = playerService.updatePlayer(playerId, updates);
      
      if (!updatedPlayer) {
        throw ApiErrors.NotFound('Player', playerId);
      }
      
      return updatedPlayer;
    })
  }
];

// Player Stats Routes
const playerStatsRoutes: RouteDefinition[] = [
  {
    path: '/players/:id/stats',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const playerId = context.params.id;
      
      if (!playerId) {
        throw ApiErrors.BadRequest('Player ID is required');
      }
      
      const stats = playerService.getPlayerStats(playerId);
      
      if (!stats) {
        throw ApiErrors.NotFound('Player stats', playerId);
      }
      
      return stats;
    })
  },
  {
    path: '/players/:id/stats',
    method: 'PUT',
    requiresAuth: true,
    cacheEnabled: false,
    handler: withErrorHandling((context: RequestContext) => {
      const playerId = context.params.id;
      const updates = context.body;
      
      if (!playerId) {
        throw ApiErrors.BadRequest('Player ID is required');
      }
      
      // Only allow admins to update stats directly (in a real app)
      // For now, we'll just check if the user is updating their own stats
      if (context.userId !== playerId) {
        throw ApiErrors.Forbidden('You can only update your own stats');
      }
      
      const updatedStats = playerService.updatePlayerStats(playerId, updates);
      
      if (!updatedStats) {
        throw ApiErrors.NotFound('Player stats', playerId);
      }
      
      return updatedStats;
    })
  }
];

// Friend Management Routes
const friendRoutes: RouteDefinition[] = [
  {
    path: '/players/:id/friends',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const playerId = context.params.id;
      
      if (!playerId) {
        throw ApiErrors.BadRequest('Player ID is required');
      }
      
      const friends = playerService.getPlayerFriends(playerId);
      return friends;
    })
  },
  {
    path: '/players/:id/friends/:friendId',
    method: 'POST',
    requiresAuth: true,
    cacheEnabled: false,
    handler: withErrorHandling((context: RequestContext) => {
      const playerId = context.params.id;
      const friendId = context.params.friendId;
      
      if (!playerId || !friendId) {
        throw ApiErrors.BadRequest('Player ID and friend ID are required');
      }
      
      // Check if user is adding a friend to their own profile
      if (context.userId !== playerId) {
        throw ApiErrors.Forbidden('You can only manage your own friends');
      }
      
      const success = playerService.addFriend(playerId, friendId);
      
      if (!success) {
        throw ApiErrors.NotFound('Player', playerId);
      }
      
      return { success: true, playerId, friendId };
    })
  },
  {
    path: '/players/:id/friends/:friendId',
    method: 'DELETE',
    requiresAuth: true,
    cacheEnabled: false,
    handler: withErrorHandling((context: RequestContext) => {
      const playerId = context.params.id;
      const friendId = context.params.friendId;
      
      if (!playerId || !friendId) {
        throw ApiErrors.BadRequest('Player ID and friend ID are required');
      }
      
      // Check if user is removing a friend from their own profile
      if (context.userId !== playerId) {
        throw ApiErrors.Forbidden('You can only manage your own friends');
      }
      
      const success = playerService.removeFriend(playerId, friendId);
      
      if (!success) {
        throw ApiErrors.NotFound('Player', playerId);
      }
      
      return { success: true, playerId, friendId };
    })
  }
];

// Combine all player routes
export const playerRoutes: RouteDefinition[] = [
  ...authRoutes,
  ...playerProfileRoutes,
  ...playerStatsRoutes,
  ...friendRoutes
];