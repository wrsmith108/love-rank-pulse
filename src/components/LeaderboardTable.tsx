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
}

export const LeaderboardTable = ({
  players,
  currentPlayerId,
  isLoading = false
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

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg overflow-hidden border border-border p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">Loading leaderboard data...</p>
        </div>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="bg-card rounded-lg overflow-hidden border border-border p-8">
        <div className="text-center text-muted-foreground">
          <p>No players found for this leaderboard.</p>
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

      {/* Table Body */}
      <div className="divide-y divide-border">
        {players.map((player) => (
          <div
            key={player.player_id}
            onMouseEnter={() => handleRowMouseEnter(player.player_id)}
            onMouseLeave={handleRowMouseLeave}
            className={`transition-colors duration-200 ${
              highlightedPlayerId === player.player_id ? 'bg-primary/5' : ''
            }`}
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
    </div>
  );
};
