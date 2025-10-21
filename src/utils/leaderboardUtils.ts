import { 
  LeaderboardEntry, 
  LeaderboardFilter, 
  TimePeriod, 
  SortCriteria,
  LeaderboardScope
} from '../models';

/**
 * Filter leaderboard entries by time period
 * @param entries Leaderboard entries to filter
 * @param timePeriod Time period to filter by
 * @returns Filtered leaderboard entries
 */
export function filterByTimePeriod(
  entries: LeaderboardEntry[], 
  timePeriod: TimePeriod
): LeaderboardEntry[] {
  const now = new Date();
  let startDate: Date;
  
  switch (timePeriod) {
    case TimePeriod.SESSION:
      // Session is a special case handled elsewhere
      return entries;
    
    case TimePeriod.HOUR:
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    
    case TimePeriod.TODAY:
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    
    case TimePeriod.WEEK:
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
      break;
    
    case TimePeriod.MONTH:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    
    case TimePeriod.ALL_TIME:
    default:
      return entries;
  }
  
  return entries.filter(entry => entry.lastPlayed >= startDate);
}

/**
 * Filter leaderboard entries by country
 * @param entries Leaderboard entries to filter
 * @param countryCode Country code to filter by
 * @returns Filtered leaderboard entries
 */
export function filterByCountry(
  entries: LeaderboardEntry[], 
  countryCode: string
): LeaderboardEntry[] {
  return entries.filter(entry => entry.countryCode === countryCode);
}

/**
 * Filter leaderboard entries to show only friends
 * @param entries Leaderboard entries to filter
 * @returns Filtered leaderboard entries
 */
export function filterFriendsOnly(
  entries: LeaderboardEntry[]
): LeaderboardEntry[] {
  return entries.filter(entry => entry.isFriend);
}

/**
 * Apply multiple filters to leaderboard entries
 * @param entries Leaderboard entries to filter
 * @param filter Filter criteria
 * @returns Filtered leaderboard entries
 */
export function applyFilters(
  entries: LeaderboardEntry[], 
  filter: LeaderboardFilter
): LeaderboardEntry[] {
  let filteredEntries = [...entries];
  
  if (filter.timePeriod) {
    filteredEntries = filterByTimePeriod(filteredEntries, filter.timePeriod);
  }
  
  if (filter.countryCode) {
    filteredEntries = filterByCountry(filteredEntries, filter.countryCode);
  }
  
  if (filter.friendsOnly) {
    filteredEntries = filterFriendsOnly(filteredEntries);
  }
  
  return filteredEntries;
}

/**
 * Sort leaderboard entries by a specific criterion
 * @param entries Leaderboard entries to sort
 * @param sortBy Criterion to sort by
 * @param sortDirection Direction to sort in
 * @returns Sorted leaderboard entries
 */
export function sortEntries(
  entries: LeaderboardEntry[], 
  sortBy: SortCriteria, 
  sortDirection: 'asc' | 'desc' = 'desc'
): LeaderboardEntry[] {
  const sortedEntries = [...entries];
  
  sortedEntries.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case SortCriteria.RANK:
        comparison = a.rank - b.rank;
        break;
      
      case SortCriteria.KD_RATIO:
        comparison = a.kdRatio - b.kdRatio;
        break;
      
      case SortCriteria.KILLS:
        comparison = a.kills - b.kills;
        break;
      
      case SortCriteria.WINS:
        comparison = a.wins - b.wins;
        break;
      
      case SortCriteria.SCORE:
        comparison = a.score - b.score;
        break;
      
      case SortCriteria.ACCURACY:
        comparison = a.accuracy - b.accuracy;
        break;
      
      case SortCriteria.HEADSHOTS:
        comparison = a.headshots - b.headshots;
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });
  
  return sortedEntries;
}

/**
 * Apply pagination to leaderboard entries
 * @param entries Leaderboard entries to paginate
 * @param page Page number (1-based)
 * @param pageSize Number of entries per page
 * @returns Paginated leaderboard entries
 */
export function paginateEntries(
  entries: LeaderboardEntry[], 
  page: number = 1, 
  pageSize: number = 10
): LeaderboardEntry[] {
  const startIndex = (page - 1) * pageSize;
  return entries.slice(startIndex, startIndex + pageSize);
}

/**
 * Get a player's rank in a leaderboard
 * @param entries Leaderboard entries
 * @param playerId Player ID to find
 * @returns Player's rank or -1 if not found
 */
export function getPlayerRank(
  entries: LeaderboardEntry[], 
  playerId: string
): number {
  const entry = entries.find(entry => entry.playerId === playerId);
  return entry ? entry.rank : -1;
}

/**
 * Calculate a player's percentile in a leaderboard
 * @param entries Leaderboard entries
 * @param playerId Player ID to calculate for
 * @returns Player's percentile (0-100) or -1 if not found
 */
export function getPlayerPercentile(
  entries: LeaderboardEntry[], 
  playerId: string
): number {
  const rank = getPlayerRank(entries, playerId);
  if (rank === -1) return -1;
  
  return Math.round((1 - (rank / entries.length)) * 100);
}

/**
 * Get nearby players in a leaderboard
 * @param entries Leaderboard entries
 * @param playerId Player ID to find neighbors for
 * @param count Number of players to include on each side
 * @returns Array of nearby players
 */
export function getNearbyPlayers(
  entries: LeaderboardEntry[], 
  playerId: string, 
  count: number = 2
): LeaderboardEntry[] {
  const playerIndex = entries.findIndex(entry => entry.playerId === playerId);
  if (playerIndex === -1) return [];
  
  const startIndex = Math.max(0, playerIndex - count);
  const endIndex = Math.min(entries.length, playerIndex + count + 1);
  
  return entries.slice(startIndex, endIndex);
}

/**
 * Calculate derived statistics for a leaderboard entry
 * @param entry Leaderboard entry to calculate for
 * @returns Object with derived statistics
 */
export function calculateDerivedStats(entry: LeaderboardEntry): {
  headshotPercentage: number;
  averageKillsPerMatch: number;
  averageDeathsPerMatch: number;
  winLossRatio: number;
} {
  const headshotPercentage = entry.kills > 0 ? 
    Math.round((entry.headshots / entry.kills) * 100) : 0;
  
  const averageKillsPerMatch = entry.matchesPlayed > 0 ? 
    parseFloat((entry.kills / entry.matchesPlayed).toFixed(2)) : 0;
  
  const averageDeathsPerMatch = entry.matchesPlayed > 0 ? 
    parseFloat((entry.deaths / entry.matchesPlayed).toFixed(2)) : 0;
  
  const winLossRatio = entry.losses > 0 ? 
    parseFloat((entry.wins / entry.losses).toFixed(2)) : entry.wins;
  
  return {
    headshotPercentage,
    averageKillsPerMatch,
    averageDeathsPerMatch,
    winLossRatio
  };
}

/**
 * Format a leaderboard scope for display
 * @param scope Leaderboard scope
 * @returns Formatted scope string
 */
export function formatScope(scope: LeaderboardScope): string {
  switch (scope) {
    case LeaderboardScope.SESSION:
      return 'Current Session';
    
    case LeaderboardScope.COUNTRY:
      return 'Country';
    
    case LeaderboardScope.GLOBAL:
      return 'Global';
    
    default:
      return scope;
  }
}

/**
 * Format a time period for display
 * @param timePeriod Time period
 * @returns Formatted time period string
 */
export function formatTimePeriod(timePeriod: TimePeriod): string {
  switch (timePeriod) {
    case TimePeriod.SESSION:
      return 'Current Session';
    
    case TimePeriod.HOUR:
      return 'Last Hour';
    
    case TimePeriod.TODAY:
      return 'Today';
    
    case TimePeriod.WEEK:
      return 'This Week';
    
    case TimePeriod.MONTH:
      return 'This Month';
    
    case TimePeriod.ALL_TIME:
      return 'All Time';
    
    default:
      return timePeriod;
  }
}

/**
 * Format a sort criterion for display
 * @param sortBy Sort criterion
 * @returns Formatted sort criterion string
 */
export function formatSortCriterion(sortBy: SortCriteria): string {
  switch (sortBy) {
    case SortCriteria.RANK:
      return 'Rank';
    
    case SortCriteria.KD_RATIO:
      return 'K/D Ratio';
    
    case SortCriteria.KILLS:
      return 'Kills';
    
    case SortCriteria.WINS:
      return 'Wins';
    
    case SortCriteria.SCORE:
      return 'Score';
    
    case SortCriteria.ACCURACY:
      return 'Accuracy';
    
    case SortCriteria.HEADSHOTS:
      return 'Headshots';
    
    default:
      return sortBy;
  }
}