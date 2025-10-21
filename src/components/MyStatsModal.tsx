import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

interface PlayerStats {
  player_name: string;
  country_code: string;
  kd_ratio: number;
  kills: number;
  deaths: number;
  wins: number;
  losses: number;
  win_rate: number;
  session_rank: number;
  country_rank: number;
  global_rank: number;
  total_session_players: number;
  total_country_players: number;
  total_global_players: number;
}

interface MyStatsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: PlayerStats | null;
}

const getCountryFlag = (countryCode: string) => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export const MyStatsModal = ({ open, onOpenChange, stats }: MyStatsModalProps) => {
  if (!stats) return null;

  const isPositiveKD = stats.kd_ratio > 1.0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">My Statistics</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Player Header */}
          <div className="flex items-center gap-3 p-4 bg-card-elevated rounded-lg border border-border">
            <span className="text-3xl">{getCountryFlag(stats.country_code)}</span>
            <div>
              <h3 className="text-xl font-bold">{stats.player_name}</h3>
              <Badge variant="outline" className="mt-1">
                {stats.country_code}
              </Badge>
            </div>
          </div>

          {/* Hero Stat - K/D Ratio */}
          <div className="text-center p-6 bg-gradient-to-br from-card-elevated to-card rounded-lg border border-border card-glow">
            <div className="text-sm text-muted-foreground mb-2">K/D RATIO</div>
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className={`w-8 h-8 ${isPositiveKD ? "text-success" : "text-destructive"}`} />
              <div className={`text-5xl font-bold ${isPositiveKD ? "text-success" : "text-destructive"}`}>
                {stats.kd_ratio.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-card-elevated rounded-lg border border-border text-center">
              <div className="text-sm text-muted-foreground mb-1">Kills</div>
              <div className="text-2xl font-bold text-success">{stats.kills}</div>
            </div>
            <div className="p-4 bg-card-elevated rounded-lg border border-border text-center">
              <div className="text-sm text-muted-foreground mb-1">Deaths</div>
              <div className="text-2xl font-bold text-destructive">{stats.deaths}</div>
            </div>
            <div className="p-4 bg-card-elevated rounded-lg border border-border text-center">
              <div className="text-sm text-muted-foreground mb-1">Win Rate</div>
              <div className="text-2xl font-bold text-primary">{stats.win_rate}%</div>
            </div>
            <div className="p-4 bg-card-elevated rounded-lg border border-border text-center">
              <div className="text-sm text-muted-foreground mb-1">Record</div>
              <div className="text-2xl font-bold">
                <span className="text-success">{stats.wins}</span>
                <span className="text-muted-foreground"> - </span>
                <span className="text-destructive">{stats.losses}</span>
              </div>
            </div>
          </div>

          {/* Rankings */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">RANKINGS</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-3 bg-card-elevated rounded-lg border border-border">
                <span className="text-sm font-medium">Session</span>
                <span className="text-sm font-bold text-primary">
                  #{stats.session_rank} of {stats.total_session_players}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-card-elevated rounded-lg border border-border">
                <span className="text-sm font-medium">Country</span>
                <span className="text-sm font-bold text-primary">
                  #{stats.country_rank} of {stats.total_country_players.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-card-elevated rounded-lg border border-border">
                <span className="text-sm font-medium">Global</span>
                <span className="text-sm font-bold text-primary">
                  #{stats.global_rank} of {stats.total_global_players.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
