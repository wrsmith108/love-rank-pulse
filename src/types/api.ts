import { 
  Player, 
  PlayerStats, 
  Match, 
  MatchResult, 
  Leaderboard, 
  LeaderboardEntry,
  LeaderboardScope,
  TimePeriod,
  SortCriteria
} from '../models';

/**
 * Base API response interface
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Paginated API response
 */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

/**
 * Player API responses
 */
export namespace PlayerApi {
  export interface GetPlayerResponse extends ApiResponse<Player> {}
  
  export interface GetPlayersResponse extends PaginatedApiResponse<Player> {}
  
  export interface GetPlayerStatsResponse extends ApiResponse<PlayerStats> {}
  
  export interface SearchPlayersResponse extends PaginatedApiResponse<Player> {}
  
  export interface GetPlayerFriendsResponse extends PaginatedApiResponse<Player> {}
  
  export interface UpdatePlayerRequest {
    displayName?: string;
    countryCode?: string;
    avatarUrl?: string;
    settings?: {
      notifications?: boolean;
      privacy?: string;
      theme?: string;
      language?: string;
    };
  }
  
  export interface UpdatePlayerResponse extends ApiResponse<Player> {}
  
  export interface AddFriendResponse extends ApiResponse<{
    success: boolean;
    friendId: string;
  }> {}
  
  export interface RemoveFriendResponse extends ApiResponse<{
    success: boolean;
    friendId: string;
  }> {}
}

/**
 * Match API responses
 */
export namespace MatchApi {
  export interface GetMatchResponse extends ApiResponse<Match> {}
  
  export interface GetMatchesResponse extends PaginatedApiResponse<Match> {}
  
  export interface GetActiveMatchesResponse extends PaginatedApiResponse<Match> {}
  
  export interface GetMatchResultsResponse extends ApiResponse<MatchResult[]> {}
  
  export interface GetPlayerMatchesResponse extends PaginatedApiResponse<Match> {}
  
  export interface GetPlayerMatchResultsResponse extends PaginatedApiResponse<MatchResult> {}
  
  export interface JoinMatchRequest {
    matchId: string;
    team?: 'red' | 'blue';
  }
  
  export interface JoinMatchResponse extends ApiResponse<{
    success: boolean;
    matchId: string;
    team?: 'red' | 'blue';
  }> {}
  
  export interface LeaveMatchResponse extends ApiResponse<{
    success: boolean;
    matchId: string;
  }> {}
  
  export interface SubmitMatchResultRequest {
    matchId: string;
    kills: number;
    deaths: number;
    assists: number;
    score: number;
    headshots: number;
    accuracy: number;
    weaponStats?: {
      weaponId: string;
      weaponName: string;
      kills: number;
      headshots: number;
      accuracy: number;
      timeUsed: number;
    }[];
  }
  
  export interface SubmitMatchResultResponse extends ApiResponse<MatchResult> {}
}

/**
 * Leaderboard API responses
 */
export namespace LeaderboardApi {
  export interface GetLeaderboardResponse extends ApiResponse<Leaderboard> {}
  
  export interface GetLeaderboardsResponse extends PaginatedApiResponse<Leaderboard> {}
  
  export interface GetLeaderboardEntriesResponse extends PaginatedApiResponse<LeaderboardEntry> {}
  
  export interface GetPlayerLeaderboardEntryResponse extends ApiResponse<LeaderboardEntry> {}
  
  export interface GetPlayerLeaderboardEntriesResponse extends ApiResponse<LeaderboardEntry[]> {}
  
  export interface GetLeaderboardFilterOptions {
    scope?: LeaderboardScope;
    timePeriod?: TimePeriod;
    countryCode?: string;
    friendsOnly?: boolean;
    sortBy?: SortCriteria;
    sortDirection?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }
  
  export interface GetFilteredLeaderboardResponse extends PaginatedApiResponse<LeaderboardEntry> {
    filter: {
      scope: LeaderboardScope;
      timePeriod: TimePeriod;
      countryCode?: string;
      friendsOnly: boolean;
      sortBy: SortCriteria;
      sortDirection: 'asc' | 'desc';
    };
  }
  
  export interface GetTopPlayersResponse extends ApiResponse<LeaderboardEntry[]> {}
  
  export interface GetPlayerRankResponse extends ApiResponse<{
    playerId: string;
    rank: number;
    percentile: number;
    nearbyPlayers: LeaderboardEntry[];
  }> {}
}

/**
 * Dashboard API responses
 */
export namespace DashboardApi {
  export interface PlayerSummary {
    playerId: string;
    playerName: string;
    countryCode: string;
    sessionRank: number;
    countryRank: number;
    globalRank: number;
    kdRatio: number;
    winRate: number;
    recentPerformance: 'improving' | 'steady' | 'declining';
    lastPlayed: string;
  }
  
  export interface RecentMatch {
    matchId: string;
    mapName: string;
    gameMode: string;
    result: 'win' | 'loss' | 'draw';
    kdRatio: number;
    score: number;
    playedAt: string;
  }
  
  export interface PerformanceStats {
    kdRatio: number;
    winRate: number;
    accuracy: number;
    averageScore: number;
    totalKills: number;
    totalDeaths: number;
    totalWins: number;
    totalLosses: number;
    favoriteWeapon: string;
    playtime: number;
  }
  
  export interface GetDashboardResponse extends ApiResponse<{
    playerSummary: PlayerSummary;
    recentMatches: RecentMatch[];
    performanceStats: PerformanceStats;
    topPlayers: LeaderboardEntry[];
    friendsActivity: {
      playerId: string;
      playerName: string;
      activity: 'online' | 'in_match' | 'offline';
      lastSeen: string;
    }[];
  }> {}
}

/**
 * Notification API responses
 */
export namespace NotificationApi {
  export interface Notification {
    id: string;
    type: 'friend_request' | 'match_invite' | 'rank_change' | 'achievement' | 'system';
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    data?: Record<string, any>;
  }
  
  export interface GetNotificationsResponse extends PaginatedApiResponse<Notification> {}
  
  export interface MarkNotificationReadResponse extends ApiResponse<{
    notificationId: string;
    isRead: boolean;
  }> {}
  
  export interface DeleteNotificationResponse extends ApiResponse<{
    notificationId: string;
    success: boolean;
  }> {}
}

/**
 * Authentication API responses
 */
export namespace AuthApi {
  export interface LoginRequest {
    email: string;
    password: string;
  }
  
  export interface LoginResponse extends ApiResponse<{
    token: string;
    refreshToken: string;
    expiresIn: number;
    player: Player;
  }> {}
  
  export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    countryCode: string;
  }
  
  export interface RegisterResponse extends ApiResponse<{
    success: boolean;
    message: string;
  }> {}
  
  export interface RefreshTokenResponse extends ApiResponse<{
    token: string;
    refreshToken: string;
    expiresIn: number;
  }> {}
  
  export interface LogoutResponse extends ApiResponse<{
    success: boolean;
  }> {}
}

/**
 * Frontend component props derived from API responses
 */
export namespace ComponentProps {
  export interface LeaderboardTableProps {
    players: LeaderboardEntry[];
    currentPlayerId?: string;
    isLoading?: boolean;
  }
  
  export interface LeaderboardRowProps {
    rank: number;
    playerName: string;
    countryCode: string;
    kills: number;
    deaths: number;
    kdRatio: number;
    isWin: boolean;
    isCurrentPlayer?: boolean;
    isMobile?: boolean;
    headshots?: number;
    accuracy?: number;
    score?: number;
  }
  
  export interface FilterBarProps {
    timePeriod: TimePeriod;
    onTimePeriodChange: (value: TimePeriod) => void;
    isLive?: boolean;
    sortBy?: SortCriteria;
    onSortChange?: (value: SortCriteria) => void;
    onRefresh?: () => void;
    showOnlyFriends?: boolean;
    onToggleFriends?: (value: boolean) => void;
  }
  
  export interface MyStatsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stats: PlayerStats | null;
  }
  
  export interface HeaderProps {
    activeTab: 'session' | 'country' | 'global';
    onTabChange: (tab: 'session' | 'country' | 'global') => void;
    onMyStatsClick: () => void;
  }
}