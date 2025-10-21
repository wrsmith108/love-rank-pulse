import { LeaderboardRow } from "./LeaderboardRow";

export interface Player {
  player_id: string;
  player_name: string;
  country_code: string;
  kills: number;
  deaths: number;
  kd_ratio: number;
  is_win: boolean;
  rank: number;
}

interface LeaderboardTableProps {
  players: Player[];
  currentPlayerId?: string;
}

export const LeaderboardTable = ({ players, currentPlayerId }: LeaderboardTableProps) => {
  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border">
      {/* Table Header */}
      <div className="grid grid-cols-7 gap-4 px-4 py-3 bg-card-elevated border-b border-border">
        <div className="text-xs font-semibold text-muted-foreground text-center">RANK</div>
        <div className="col-span-2 text-xs font-semibold text-muted-foreground">PLAYER</div>
        <div className="text-xs font-semibold text-muted-foreground text-center">K/D</div>
        <div className="text-xs font-semibold text-muted-foreground text-center">KILLS</div>
        <div className="text-xs font-semibold text-muted-foreground text-center">DEATHS</div>
        <div className="text-xs font-semibold text-muted-foreground text-center">W/L</div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-border">
        {players.map((player) => (
          <LeaderboardRow
            key={player.player_id}
            rank={player.rank}
            playerName={player.player_name}
            countryCode={player.country_code}
            kills={player.kills}
            deaths={player.deaths}
            kdRatio={player.kd_ratio}
            isWin={player.is_win}
            isCurrentPlayer={player.player_id === currentPlayerId}
          />
        ))}
      </div>
    </div>
  );
};
