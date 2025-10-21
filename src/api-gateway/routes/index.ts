import { apiGateway } from '../ApiGateway';
import { playerRoutes } from './playerRoutes';
import { matchRoutes } from './matchRoutes';
import { leaderboardRoutes } from './leaderboardRoutes';

/**
 * Register all API routes with the API Gateway
 */
export function registerAllRoutes(): void {
  // Register player routes
  apiGateway.registerRoutes(playerRoutes);
  
  // Register match routes
  apiGateway.registerRoutes(matchRoutes);
  
  // Register leaderboard routes
  apiGateway.registerRoutes(leaderboardRoutes);
  
  console.log(`[API Gateway] Registered ${
    playerRoutes.length + matchRoutes.length + leaderboardRoutes.length
  } routes`);
}

// Export all routes
export { playerRoutes } from './playerRoutes';
export { matchRoutes } from './matchRoutes';
export { leaderboardRoutes } from './leaderboardRoutes';