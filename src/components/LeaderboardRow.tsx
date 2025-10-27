import * as React from "react";
import { Medal, TrendingUp, TrendingDown, Target, Percent, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Medal className="w-4 h-4 text-rank-gold" />;
  if (rank === 2) return <Medal className="w-4 h-4 text-rank-silver" />;
  if (rank === 3) return <Medal className="w-4 h-4 text-rank-bronze" />;
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
  isMobile = false,
  headshots = 0,
  accuracy = 0,
  score = 0,
}: LeaderboardRowProps) => {
  const isPositiveKD = kdRatio > 1.0;
  const kdClass = kdRatio >= 2.0 ? "text-success font-bold" :
                 kdRatio >= 1.0 ? "text-success font-semibold" : "text-destructive";

  return (
    <div
      data-testid="leaderboard-row"
      className={`grid ${isMobile ? 'grid-cols-4' : 'grid-cols-7'} gap-4 px-6 py-4 transition-colors hover:bg-muted/30 ${
        isCurrentPlayer ? "bg-primary/5 border-l-2 border-l-primary" : ""
      }`}
    >
      {/* Rank */}
      <div className="flex items-center justify-center">
        {rank <= 3 ? (
          <div className="flex items-center gap-1">
            {getRankIcon(rank)}
            <span className="text-sm font-medium text-muted-foreground">{rank}</span>
          </div>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">{rank}</span>
        )}
      </div>

      {/* Player */}
      <div className={`${isMobile ? 'col-span-2' : 'col-span-2'} flex items-center gap-3 overflow-hidden`}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-lg cursor-help">{getCountryFlag(countryCode)}</span>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Country: {countryCode}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{playerName}</span>
          {score > 0 && !isMobile && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              {score} points
            </span>
          )}
        </div>
      </div>

      {/* K/D Ratio */}
      <div className="flex items-center justify-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`text-sm cursor-help ${kdClass}`}>
                {kdRatio.toFixed(2)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Kill/Death Ratio: {kills} kills / {deaths} deaths</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Mobile view ends here */}
      {!isMobile && (
        <>
          {/* Kills */}
          <div className="flex items-center justify-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm text-foreground cursor-help">
                    {kills.toLocaleString()}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{kills} kills{headshots > 0 ? ` (${headshots} headshots)` : ''}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Deaths */}
          <div className="flex items-center justify-center">
            <span className="text-sm text-muted-foreground">{deaths.toLocaleString()}</span>
          </div>

          {/* W/L */}
          <div className="flex items-center justify-center">
            <span
              className={`text-sm font-medium ${
                isWin ? "text-success" : "text-destructive"
              }`}
            >
              {isWin ? "Win" : "Loss"}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
