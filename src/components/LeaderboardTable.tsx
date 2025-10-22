import * as React from "react";
import { LeaderboardRow } from "./LeaderboardRow";
import { useIsMobile } from "@/hooks/use-mobile";

export interface Player {
  player_id: string;
  player_name: string;
  country_code: string;
  kills: number;
  deaths: number;
  kd_ratio: number;
  is_win: boolean;
  rank: number;
  // Additional fields for enhanced display
  headshots?: number;
  accuracy?: number;
  score?: number;
}

interface LeaderboardTableProps {
  players: Player[];
  currentPlayerId?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const LeaderboardTable = ({
  players,
  currentPlayerId,
  isLoading = false,
  error = null,
  onRetry
}: LeaderboardTableProps) => {
  const isMobile = useIsMobile();
  const [highlightedPlayerId, setHighlightedPlayerId] = React.useState<string | null>(null);

  // Handle row hover for highlighting
  const handleRowMouseEnter = (playerId: string) => {
    setHighlightedPlayerId(playerId);
  };

  const handleRowMouseLeave = () => {
    setHighlightedPlayerId(null);
  };

  // Loading skeleton with shimmer effect
  if (isLoading) {
    return (
      <div className="bg-card rounded-lg overflow-hidden border border-border">
        {/* Header skeleton */}
        <div className={`grid ${isMobile ? 'grid-cols-4' : 'grid-cols-7'} gap-4 px-4 py-3 bg-card-elevated border-b border-border`}>
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className={`${isMobile ? 'col-span-2' : 'col-span-2'} h-4 bg-muted rounded animate-pulse`} />
          <div className="h-4 bg-muted rounded animate-pulse" />
          {!isMobile && (
            <>
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse" />
            </>
          )}
        </div>

        {/* Body skeleton */}
        <div className="divide-y divide-border">
          {[...Array(10)].map((_, index) => (
            <div key={index} className={`grid ${isMobile ? 'grid-cols-4' : 'grid-cols-7'} gap-4 px-4 py-4 animate-pulse`}>
              <div className="h-6 bg-muted rounded" />
              <div className={`${isMobile ? 'col-span-2' : 'col-span-2'} h-6 bg-muted rounded`} />
              <div className="h-6 bg-muted rounded" />
              {!isMobile && (
                <>
                  <div className="h-6 bg-muted rounded" />
                  <div className="h-6 bg-muted rounded" />
                  <div className="h-6 bg-muted rounded" />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state with retry button
  if (error) {
    return (
      <div className="bg-card rounded-lg overflow-hidden border border-destructive/20 p-8">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Failed to load leaderboard</h3>
            <p className="text-sm text-muted-foreground max-w-md">{error}</p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Empty state with helpful message
  if (players.length === 0) {
    return (
      <div className="bg-card rounded-lg overflow-hidden border border-border p-12">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">No players yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              This leaderboard is empty. Be the first to play and claim the top spot!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border shadow-sm">
      {/* Table Header */}
      <div className={`grid ${isMobile ? 'grid-cols-4' : 'grid-cols-7'} gap-4 px-4 py-3 bg-card-elevated border-b border-border sticky top-0 z-10`}>
        <div className="text-xs font-semibold text-muted-foreground text-center">RANK</div>
        <div className={`${isMobile ? 'col-span-2' : 'col-span-2'} text-xs font-semibold text-muted-foreground`}>PLAYER</div>
        <div className="text-xs font-semibold text-muted-foreground text-center">K/D</div>
        {!isMobile && (
          <>
            <div className="text-xs font-semibold text-muted-foreground text-center">KILLS</div>
            <div className="text-xs font-semibold text-muted-foreground text-center">DEATHS</div>
            <div className="text-xs font-semibold text-muted-foreground text-center">W/L</div>
          </>
        )}
      </div>

      {/* Table Body with smooth transitions */}
      <div className="divide-y divide-border">
        {players.map((player, index) => (
          <div
            key={player.player_id}
            onMouseEnter={() => handleRowMouseEnter(player.player_id)}
            onMouseLeave={handleRowMouseLeave}
            className={`transition-all duration-300 ${
              highlightedPlayerId === player.player_id ? 'bg-primary/5 scale-[1.01]' : ''
            }`}
            style={{
              animation: `fadeIn 0.3s ease-in-out ${index * 0.05}s both`
            }}
          >
            <LeaderboardRow
              rank={player.rank}
              playerName={player.player_name}
              countryCode={player.country_code}
              kills={player.kills}
              deaths={player.deaths}
              kdRatio={player.kd_ratio}
              isWin={player.is_win}
              isCurrentPlayer={player.player_id === currentPlayerId}
              isMobile={isMobile}
              headshots={player.headshots}
              accuracy={player.accuracy}
              score={player.score}
            />
          </div>
        ))}
      </div>

      {/* Add fadeIn animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
