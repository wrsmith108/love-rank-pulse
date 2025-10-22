/**
 * Type definitions for mutation API responses
 */

export interface AddFriendResponse {
  success: boolean;
  message: string;
  data: {
    playerId: string;
    playerName: string;
    addedAt: Date;
  };
}

export interface ReportPlayerResponse {
  success: boolean;
  message: string;
  data: {
    reportId: string;
    playerId: string;
    reason: string;
    status: string;
    reportedAt: Date;
  };
}

export interface VoteKickResponse {
  success: boolean;
  message: string;
  data: {
    votesNeeded: number;
    currentVotes: number;
    playerId: string;
    matchId: string;
  };
}

export interface LoadMorePlayersResponse {
  players: any[];
  hasMore: boolean;
}

export interface RefreshLeaderboardResponse {
  success: boolean;
}
