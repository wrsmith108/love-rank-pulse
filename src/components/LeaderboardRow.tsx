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
  if (rank === 1) return <Medal className="w-5 h-5 text-[#FFD700]" />; // Gold
  if (rank === 2) return <Medal className="w-5 h-5 text-[#C0C0C0]" />; // Silver
  if (rank === 3) return <Medal className="w-5 h-5 text-[#CD7F32]" />; // Bronze
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
  const kdClass = kdRatio >= 2.0 ? "text-success font-extrabold" :
                 kdRatio >= 1.0 ? "text-success" : "text-destructive";

  return (
    <div
      data-testid="leaderboard-row"
      className={`grid ${isMobile ? 'grid-cols-4' : 'grid-cols-7'} gap-4 px-4 py-3 transition-all ${
        isCurrentPlayer ? "bg-primary/10 border-l-4 border-l-primary" : ""
      }`}
    >
      {/* Rank */}
      <div className="flex items-center justify-center">
        {rank <= 3 ? (
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/40 rounded-full blur-sm"></div>
            {getRankIcon(rank)}
          </div>
        ) : (
          <span className="text-base font-semibold text-muted-foreground">#{rank}</span>
        )}
      </div>

      {/* Player */}
      <div className={`${isMobile ? 'col-span-2' : 'col-span-2'} flex items-center gap-2 overflow-hidden`}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xl cursor-help">{getCountryFlag(countryCode)}</span>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Country: {countryCode}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-base font-medium truncate">{playerName}</span>
        {score > 0 && !isMobile && (
          <div className="ml-auto inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-background text-foreground">
            <Trophy className="w-3 h-3 mr-1" />
            <span>{score}</span>
          </div>
        )}
      </div>

      {/* K/D Ratio */}
      <div className="flex items-center justify-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                {isPositiveKD ? (
                  <TrendingUp className="w-4 h-4 text-success" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-destructive" />
                )}
                <span className={`text-base font-bold ${kdClass}`}>
                  {kdRatio.toFixed(2)}
                </span>
              </div>
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
                  <div className="flex items-center gap-1 cursor-help">
                    <span className="text-base text-foreground">{kills}</span>
                    {headshots > 0 && (
                      <Target className="w-3 h-3 text-destructive ml-1" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{kills} kills{headshots > 0 ? ` (${headshots} headshots)` : ''}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Deaths */}
          <div className="flex items-center justify-center">
            <span className="text-base text-muted-foreground">{deaths}</span>
          </div>

          {/* W/L */}
          <div className="flex items-center justify-center">
            <div
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                isWin
                  ? "border-transparent bg-success text-success-foreground"
                  : "border-transparent bg-destructive text-destructive-foreground"
              }`}
            >
              {isWin ? "W" : "L"}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
