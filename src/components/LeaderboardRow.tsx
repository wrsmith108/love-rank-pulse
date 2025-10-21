import { Medal, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LeaderboardRowProps {
  rank: number;
  playerName: string;
  countryCode: string;
  kills: number;
  deaths: number;
  kdRatio: number;
  isWin: boolean;
  isCurrentPlayer?: boolean;
}

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Medal className="w-5 h-5 text-rank-gold" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-rank-silver" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-rank-bronze" />;
  return null;
};

const getCountryFlag = (countryCode: string) => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export const LeaderboardRow = ({
  rank,
  playerName,
  countryCode,
  kills,
  deaths,
  kdRatio,
  isWin,
  isCurrentPlayer,
}: LeaderboardRowProps) => {
  const isPositiveKD = kdRatio > 1.0;

  return (
    <div
      className={`grid grid-cols-7 gap-4 px-4 py-3 border-b border-border transition-all hover:bg-card-elevated ${
        isCurrentPlayer ? "bg-primary/10 border-l-4 border-l-primary" : ""
      }`}
    >
      {/* Rank */}
      <div className="flex items-center justify-center">
      {rank <= 3 ? (
        getRankIcon(rank)
      ) : (
        <span className="text-base font-semibold text-muted-foreground">#{rank}</span>
      )}
      </div>

      {/* Player */}
      <div className="col-span-2 flex items-center gap-2">
        <span className="text-xl">{getCountryFlag(countryCode)}</span>
        <span className="text-base font-medium truncate">{playerName}</span>
      </div>

      {/* K/D Ratio */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1">
          {isPositiveKD ? (
            <TrendingUp className="w-4 h-4 text-success" />
          ) : (
            <TrendingDown className="w-4 h-4 text-destructive" />
          )}
          <span
            className={`text-base font-bold ${
              isPositiveKD ? "text-success" : "text-destructive"
            }`}
          >
            {kdRatio.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Kills */}
      <div className="flex items-center justify-center">
        <span className="text-base text-foreground">{kills}</span>
      </div>

      {/* Deaths */}
      <div className="flex items-center justify-center">
        <span className="text-base text-muted-foreground">{deaths}</span>
      </div>

      {/* W/L */}
      <div className="flex items-center justify-center">
        <Badge
          variant={isWin ? "default" : "destructive"}
          className={isWin ? "bg-success hover:bg-success/90" : ""}
        >
          {isWin ? "W" : "L"}
        </Badge>
      </div>
    </div>
  );
};
