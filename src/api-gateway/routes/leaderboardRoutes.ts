import { RouteDefinition } from '../ApiGateway';
import { leaderboardService } from '../../services';
import { ApiResponse, PaginatedApiResponse } from '../types/api';
import { 
  Leaderboard, 
  LeaderboardEntry, 
  LeaderboardScope, 
  TimePeriod, 
  SortCriteria,
  LeaderboardFilter
} from '../../models';
import { ApiErrors } from '../middleware/errorMiddleware';
import { withErrorHandling } from '../middleware/errorMiddleware';
import { RequestContext } from '../ApiGateway';

/**
 * Leaderboard API Routes
 * 
 * Defines routes for leaderboard-related operations:
 * - Leaderboard retrieval and filtering
 * - Player rankings and entries
 * - Leaderboard statistics
 */

// Leaderboard Retrieval Routes
const leaderboardRetrievalRoutes: RouteDefinition[] = [
  {
    path: '/leaderboards/:id',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const leaderboardId = context.params.id;
      
      if (!leaderboardId) {
        throw ApiErrors.BadRequest('Leaderboard ID is required');
      }
      
      const leaderboard = leaderboardService.getLeaderboardById(leaderboardId);
      
      if (!leaderboard) {
        throw ApiErrors.NotFound('Leaderboard', leaderboardId);
      }
      
      return leaderboard;
    })
  },
  {
    path: '/leaderboards',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      // Get query parameters for filtering
      const scope = context.query?.scope as LeaderboardScope;
      const timePeriod = context.query?.timePeriod as TimePeriod;
      
      let leaderboards: Leaderboard[];
      
      if (scope) {
        // Filter leaderboards by scope
        leaderboards = leaderboardService.getLeaderboardsByScope(scope);
      } else if (timePeriod) {
        // Filter leaderboards by time period
        leaderboards = leaderboardService.getLeaderboardsByTimePeriod(timePeriod);
      } else {
        // Get all leaderboards
        leaderboards = leaderboardService.getAllLeaderboards();
      }
      
      return leaderboards;
    })
  },
  {
    path: '/leaderboards/session/current',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    cacheTTL: 60, // 1 minute, since session leaderboards change frequently
    handler: withErrorHandling((context: RequestContext) => {
      const sessionLeaderboard = leaderboardService.getCurrentSessionLeaderboard();
      
      if (!sessionLeaderboard) {
        throw ApiErrors.NotFound('Current session leaderboard');
      }
      
      return sessionLeaderboard;
    })
  },
  {
    path: '/leaderboards/global/:timePeriod',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const timePeriod = context.params.timePeriod as TimePeriod;
      
      if (!timePeriod) {
        throw ApiErrors.BadRequest('Time period is required');
      }
      
      const globalLeaderboard = leaderboardService.getGlobalLeaderboard(timePeriod);
      
      if (!globalLeaderboard) {
        throw ApiErrors.NotFound(`Global ${timePeriod} leaderboard`);
      }
      
      return globalLeaderboard;
    })
  },
  {
    path: '/leaderboards/country/:countryCode/:timePeriod',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const countryCode = context.params.countryCode;
      const timePeriod = context.params.timePeriod as TimePeriod;
      
      if (!countryCode || !timePeriod) {
        throw ApiErrors.BadRequest('Country code and time period are required');
      }
      
      const countryLeaderboard = leaderboardService.getCountryLeaderboard(countryCode, timePeriod);
      
      if (!countryLeaderboard) {
        throw ApiErrors.NotFound(`${countryCode} ${timePeriod} leaderboard`);
      }
      
      return countryLeaderboard;
    })
  }
];

// Leaderboard Filtering Routes
const leaderboardFilteringRoutes: RouteDefinition[] = [
  {
    path: '/leaderboards/:id/filter',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const leaderboardId = context.params.id;
      
      if (!leaderboardId) {
        throw ApiErrors.BadRequest('Leaderboard ID is required');
      }
      
      // Extract filter parameters from query
      const filter: LeaderboardFilter = {
        friendsOnly: context.query?.friendsOnly === 'true',
        countryCode: context.query?.countryCode as string,
        sortBy: context.query?.sortBy as SortCriteria || SortCriteria.RANK,
        sortDirection: (context.query?.sortDirection as 'asc' | 'desc') || 'asc',
        limit: context.query?.limit ? parseInt(context.query.limit as string) : undefined,
        offset: context.query?.offset ? parseInt(context.query.offset as string) : undefined
      };
      
      const filteredEntries = leaderboardService.filterLeaderboard(leaderboardId, filter);
      return filteredEntries;
    })
  },
  {
    path: '/leaderboards/:id/top',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const leaderboardId = context.params.id;
      const limit = context.query?.limit ? parseInt(context.query.limit as string) : 10;
      
      if (!leaderboardId) {
        throw ApiErrors.BadRequest('Leaderboard ID is required');
      }
      
      const topPlayers = leaderboardService.getTopPlayers(leaderboardId, limit);
      return topPlayers;
    })
  }
];

// Player Ranking Routes
const playerRankingRoutes: RouteDefinition[] = [
  {
    path: '/leaderboards/:id/players/:playerId',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const leaderboardId = context.params.id;
      const playerId = context.params.playerId;
      
      if (!leaderboardId || !playerId) {
        throw ApiErrors.BadRequest('Leaderboard ID and player ID are required');
      }
      
      const entry = leaderboardService.getPlayerLeaderboardEntry(leaderboardId, playerId);
      
      if (!entry) {
        throw ApiErrors.NotFound(`Player ${playerId} in leaderboard ${leaderboardId}`);
      }
      
      return entry;
    })
  },
  {
    path: '/leaderboards/:id/rank/:playerId',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const leaderboardId = context.params.id;
      const playerId = context.params.playerId;
      
      if (!leaderboardId || !playerId) {
        throw ApiErrors.BadRequest('Leaderboard ID and player ID are required');
      }
      
      const rank = leaderboardService.getPlayerRank(leaderboardId, playerId);
      
      if (rank === -1) {
        throw ApiErrors.NotFound(`Player ${playerId} in leaderboard ${leaderboardId}`);
      }
      
      return { playerId, rank };
    })
  },
  {
    path: '/players/:id/leaderboard-entries',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const playerId = context.params.id;
      
      if (!playerId) {
        throw ApiErrors.BadRequest('Player ID is required');
      }
      
      const entries = leaderboardService.getPlayerLeaderboardEntries(playerId);
      return entries;
    })
  }
];

// Leaderboard Statistics Routes
const leaderboardStatsRoutes: RouteDefinition[] = [
  {
    path: '/leaderboards/:id/stats',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const leaderboardId = context.params.id;
      
      if (!leaderboardId) {
        throw ApiErrors.BadRequest('Leaderboard ID is required');
      }
      
      const stats = leaderboardService.getLeaderboardStats(leaderboardId);
      
      if (!stats) {
        throw ApiErrors.NotFound(`Stats for leaderboard ${leaderboardId}`);
      }
      
      return stats;
    })
  }
];

// Combine all leaderboard routes
export const leaderboardRoutes: RouteDefinition[] = [
  ...leaderboardRetrievalRoutes,
  ...leaderboardFilteringRoutes,
  ...playerRankingRoutes,
  ...leaderboardStatsRoutes
];