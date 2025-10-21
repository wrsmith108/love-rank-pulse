import { RouteDefinition } from '../ApiGateway';
import { matchService } from '../../services';
import { ApiResponse } from '../types/api';
import { Match, MatchResult, MatchStatus, GameMode } from '../../models';
import { ApiErrors } from '../middleware/errorMiddleware';
import { withErrorHandling } from '../middleware/errorMiddleware';
import { RequestContext } from '../ApiGateway';

/**
 * Match API Routes
 * 
 * Defines routes for match-related operations:
 * - Match retrieval and filtering
 * - Match results
 * - Player match history
 * - Match management (create, update, start, end)
 */

// Match Retrieval Routes
const matchRetrievalRoutes: RouteDefinition[] = [
  {
    path: '/matches/:id',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const matchId = context.params.id;
      
      if (!matchId) {
        throw ApiErrors.BadRequest('Match ID is required');
      }
      
      const match = matchService.getMatchById(matchId);
      
      if (!match) {
        throw ApiErrors.NotFound('Match', matchId);
      }
      
      return match;
    })
  },
  {
    path: '/matches',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      // Get query parameters for filtering
      const status = context.query?.status as MatchStatus;
      const gameMode = context.query?.gameMode as GameMode;
      const mapName = context.query?.mapName as string;
      
      let matches: Match[];
      
      if (status) {
        // Filter matches by status
        matches = matchService.getMatchesByStatus(status);
      } else if (gameMode) {
        // Filter matches by game mode
        matches = matchService.getMatchesByGameMode(gameMode);
      } else if (mapName) {
        // Filter matches by map
        matches = matchService.getMatchesByMap(mapName);
      } else {
        // Get all matches
        matches = matchService.getAllMatches();
      }
      
      return matches;
    })
  },
  {
    path: '/matches/active',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    cacheTTL: 30, // 30 seconds, since active matches change frequently
    handler: withErrorHandling((context: RequestContext) => {
      const activeMatches = matchService.getActiveMatches();
      return activeMatches;
    })
  }
];

// Match Results Routes
const matchResultsRoutes: RouteDefinition[] = [
  {
    path: '/matches/:id/results',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const matchId = context.params.id;
      
      if (!matchId) {
        throw ApiErrors.BadRequest('Match ID is required');
      }
      
      const results = matchService.getMatchResults(matchId);
      return results;
    })
  },
  {
    path: '/matches/:id/results',
    method: 'POST',
    requiresAuth: true,
    cacheEnabled: false,
    handler: withErrorHandling((context: RequestContext) => {
      const matchId = context.params.id;
      const result = context.body as MatchResult;
      
      if (!matchId || !result) {
        throw ApiErrors.BadRequest('Match ID and result data are required');
      }
      
      // Ensure the player is submitting their own result
      if (context.userId !== result.playerId) {
        throw ApiErrors.Forbidden('You can only submit your own match results');
      }
      
      // Ensure the match exists
      const match = matchService.getMatchById(matchId);
      if (!match) {
        throw ApiErrors.NotFound('Match', matchId);
      }
      
      // Add the result
      const addedResult = matchService.addMatchResult({
        ...result,
        matchId
      });
      
      return addedResult;
    })
  }
];

// Player Match History Routes
const playerMatchHistoryRoutes: RouteDefinition[] = [
  {
    path: '/players/:id/matches',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const playerId = context.params.id;
      const limit = context.query?.limit ? parseInt(context.query.limit as string) : 10;
      
      if (!playerId) {
        throw ApiErrors.BadRequest('Player ID is required');
      }
      
      const matches = matchService.getRecentPlayerMatches(playerId, limit);
      return matches;
    })
  },
  {
    path: '/players/:id/match-results',
    method: 'GET',
    requiresAuth: true,
    cacheEnabled: true,
    handler: withErrorHandling((context: RequestContext) => {
      const playerId = context.params.id;
      
      if (!playerId) {
        throw ApiErrors.BadRequest('Player ID is required');
      }
      
      // Check if user is requesting their own results or if they have permission
      if (context.userId !== playerId) {
        // In a real app, we would check if the user has permission to view other players' results
        // For now, we'll allow it for demonstration purposes
      }
      
      const results = matchService.getPlayerMatchResults(playerId);
      return results;
    })
  }
];

// Match Management Routes
const matchManagementRoutes: RouteDefinition[] = [
  {
    path: '/matches',
    method: 'POST',
    requiresAuth: true,
    cacheEnabled: false,
    handler: withErrorHandling((context: RequestContext) => {
      const matchData = context.body as Omit<Match, 'id'>;
      
      if (!matchData) {
        throw ApiErrors.BadRequest('Match data is required');
      }
      
      // Generate a unique ID for the match (in a real app, this would be done by the service)
      const match: Match = {
        ...matchData,
        id: `match_${Date.now()}`
      };
      
      // Store the creator ID in a custom property (in a real app, this would be part of the Match model)
      const matchWithMeta = {
        ...match,
        _creatorId: context.userId
      };
      
      const createdMatch = matchService.createMatch(match);
      return createdMatch;
    })
  },
  {
    path: '/matches/:id',
    method: 'PUT',
    requiresAuth: true,
    cacheEnabled: false,
    handler: withErrorHandling((context: RequestContext) => {
      const matchId = context.params.id;
      const updates = context.body;
      
      if (!matchId) {
        throw ApiErrors.BadRequest('Match ID is required');
      }
      
      // Check if the match exists
      const match = matchService.getMatchById(matchId);
      if (!match) {
        throw ApiErrors.NotFound('Match', matchId);
      }
      
      // Check if the user has permission to update the match
      // In a real app, we would check if the user is the match creator or an admin
      // For now, we'll allow all authenticated users to update matches
      // In a production environment, we would store creator information in the Match model
      
      const updatedMatch = matchService.updateMatch(matchId, updates);
      
      if (!updatedMatch) {
        throw ApiErrors.NotFound('Match', matchId);
      }
      
      return updatedMatch;
    })
  },
  {
    path: '/matches/:id/start',
    method: 'POST',
    requiresAuth: true,
    cacheEnabled: false,
    handler: withErrorHandling((context: RequestContext) => {
      const matchId = context.params.id;
      
      if (!matchId) {
        throw ApiErrors.BadRequest('Match ID is required');
      }
      
      // Check if the match exists
      const match = matchService.getMatchById(matchId);
      if (!match) {
        throw ApiErrors.NotFound('Match', matchId);
      }
      
      // Check if the user has permission to start the match
      // In a real app, we would check if the user is the match creator or an admin
      // For now, we'll allow all authenticated users to start matches
      // In a production environment, we would store creator information in the Match model
      
      const startedMatch = matchService.startMatch(matchId);
      
      if (!startedMatch) {
        throw ApiErrors.NotFound('Match', matchId);
      }
      
      return startedMatch;
    })
  },
  {
    path: '/matches/:id/end',
    method: 'POST',
    requiresAuth: true,
    cacheEnabled: false,
    handler: withErrorHandling((context: RequestContext) => {
      const matchId = context.params.id;
      const { winningTeam, mvpPlayerId } = context.body as { 
        winningTeam?: 'red' | 'blue' | 'none';
        mvpPlayerId?: string;
      };
      
      if (!matchId) {
        throw ApiErrors.BadRequest('Match ID is required');
      }
      
      // Check if the match exists
      const match = matchService.getMatchById(matchId);
      if (!match) {
        throw ApiErrors.NotFound('Match', matchId);
      }
      
      // Check if the user has permission to end the match
      // In a real app, we would check if the user is the match creator or an admin
      // For now, we'll allow all authenticated users to end matches
      // In a production environment, we would store creator information in the Match model
      
      const endedMatch = matchService.endMatch(matchId, winningTeam, mvpPlayerId);
      
      if (!endedMatch) {
        throw ApiErrors.NotFound('Match', matchId);
      }
      
      return endedMatch;
    })
  }
];

// Combine all match routes
export const matchRoutes: RouteDefinition[] = [
  ...matchRetrievalRoutes,
  ...matchResultsRoutes,
  ...playerMatchHistoryRoutes,
  ...matchManagementRoutes
];