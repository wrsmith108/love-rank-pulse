import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { AuthModal } from "./AuthModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Trophy,
  Medal,
  Skull,
  Swords,
  Timer,
  Share2,
  X
} from "lucide-react";

export interface PlayerStats {
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
  // Additional stats
  headshots?: number;
  accuracy?: number;
  playtime?: number;
  highest_killstreak?: number;
  favorite_weapon?: string;
  weapon_accuracy?: number;
  recent_performance?: "improving" | "steady" | "declining";
  matches_played?: number;
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
  const isMobile = useIsMobile();
  const { isAuthenticated, currentUser } = useAuth();
  const [activeTab, setActiveTab] = React.useState("overview");
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  
  // Handle unauthenticated state
  if (!isAuthenticated) {
    const unauthenticatedContent = (
      <div className="flex flex-col items-center justify-center py-8 space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold">Authentication Required</h3>
          <p className="text-muted-foreground">
            Please login or create an account to view your stats
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={() => {
              setShowAuthModal(true);
            }}
            className="px-6"
          >
            Login
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
    
    // Show auth modal if requested
    if (showAuthModal) {
      return (
        <AuthModal
          open={open && showAuthModal}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setShowAuthModal(false);
              onOpenChange(false);
            }
          }}
        />
      );
    }
    
    // Use Drawer for mobile and Dialog for desktop
    if (isMobile) {
      return (
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="border-b border-border">
              <DrawerTitle className="text-xl font-bold flex items-center justify-between">
                My Statistics
                <DrawerClose asChild>
                  <Button variant="ghost" size="icon">
                    <X className="w-4 h-4" />
                  </Button>
                </DrawerClose>
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 py-6 overflow-y-auto">
              {unauthenticatedContent}
            </div>
          </DrawerContent>
        </Drawer>
      );
    }
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">My Statistics</DialogTitle>
            <DialogDescription>
              View your performance stats and rankings
            </DialogDescription>
          </DialogHeader>
          {unauthenticatedContent}
        </DialogContent>
      </Dialog>
    );
  }
  
  if (!stats) return null;

  const isPositiveKD = stats.kd_ratio > 1.0;
  const headshotPercentage = stats.headshots ? Math.round((stats.headshots / stats.kills) * 100) : 0;
  
  const statsContent = (
    <div className="space-y-6 px-1">
      {/* Player Header */}
      <div className="flex items-center gap-3 p-4 bg-card-elevated rounded-lg border border-border">
        <span className="text-3xl">{getCountryFlag(stats.country_code)}</span>
        <div className="flex-1">
          <h3 className="text-xl font-bold">{stats.player_name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-background text-foreground">
              {stats.country_code}
            </div>
            {stats.recent_performance && (
              <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                stats.recent_performance === "improving"
                  ? "bg-success/20 text-success"
                  : stats.recent_performance === "declining"
                    ? "bg-destructive/20 text-destructive"
                    : "bg-secondary text-secondary-foreground"
              }`}>
                {stats.recent_performance === "improving" && "Improving"}
                {stats.recent_performance === "steady" && "Steady"}
                {stats.recent_performance === "declining" && "Declining"}
              </div>
            )}
          </div>
        </div>
        {!isMobile && (
          <Button variant="ghost" size="icon" className="ml-auto">
            <Share2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="weapons">Weapons</TabsTrigger>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {/* Hero Stat - K/D Ratio */}
          <div className="text-center p-6 bg-gradient-to-br from-card-elevated to-card rounded-lg border border-border shadow-sm">
            <div className="text-sm text-muted-foreground mb-2">K/D RATIO</div>
            <div className="flex items-center justify-center gap-2">
              {isPositiveKD ? (
                <TrendingUp className="w-8 h-8 text-success" />
              ) : (
                <TrendingDown className="w-8 h-8 text-destructive" />
              )}
              <div className={`text-5xl font-bold ${isPositiveKD ? "text-success" : "text-destructive"}`}>
                {stats.kd_ratio.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-card-elevated rounded-lg border border-border text-center">
              <div className="text-sm text-muted-foreground mb-1">Kills</div>
              <div className="text-2xl font-bold text-success">{stats.kills.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-card-elevated rounded-lg border border-border text-center">
              <div className="text-sm text-muted-foreground mb-1">Deaths</div>
              <div className="text-2xl font-bold text-destructive">{stats.deaths.toLocaleString()}</div>
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

          {/* Additional Stats */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground">PERFORMANCE METRICS</h4>
            
            {stats.headshots !== undefined && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-destructive" />
                    <span className="text-sm">Headshot Ratio</span>
                  </div>
                  <span className="text-sm font-bold">{headshotPercentage}%</span>
                </div>
                <Progress value={headshotPercentage} className="h-2" />
              </div>
            )}
            
            {stats.accuracy !== undefined && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-primary" />
                    <span className="text-sm">Accuracy</span>
                  </div>
                  <span className="text-sm font-bold">{stats.accuracy}%</span>
                </div>
                <Progress value={stats.accuracy} className="h-2" />
              </div>
            )}
            
            {stats.highest_killstreak !== undefined && (
              <div className="flex justify-between items-center p-3 bg-card-elevated rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <Skull className="w-4 h-4 text-destructive" />
                  <span className="text-sm">Highest Killstreak</span>
                </div>
                <span className="text-sm font-bold">{stats.highest_killstreak}</span>
              </div>
            )}
            
            {stats.playtime !== undefined && (
              <div className="flex justify-between items-center p-3 bg-card-elevated rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Playtime</span>
                </div>
                <span className="text-sm font-bold">{Math.floor(stats.playtime / 60)}h {stats.playtime % 60}m</span>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="weapons" className="space-y-4">
          {stats.favorite_weapon ? (
            <>
              <h4 className="text-sm font-semibold text-muted-foreground">FAVORITE WEAPON</h4>
              <div className="p-4 bg-card-elevated rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-bold">{stats.favorite_weapon}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {stats.weapon_accuracy}% accuracy
                    </div>
                  </div>
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
              </div>
              
              <div className="pt-4">
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">WEAPON STATS</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-card-elevated rounded-lg border border-border">
                    <span className="text-sm">Assault Rifles</span>
                    <span className="text-sm font-bold">42%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-card-elevated rounded-lg border border-border">
                    <span className="text-sm">SMGs</span>
                    <span className="text-sm font-bold">28%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-card-elevated rounded-lg border border-border">
                    <span className="text-sm">Sniper Rifles</span>
                    <span className="text-sm font-bold">15%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-card-elevated rounded-lg border border-border">
                    <span className="text-sm">Shotguns</span>
                    <span className="text-sm font-bold">10%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-card-elevated rounded-lg border border-border">
                    <span className="text-sm">Pistols</span>
                    <span className="text-sm font-bold">5%</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="text-muted-foreground text-center">
                <p>No weapon data available</p>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="rankings" className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground">YOUR RANKINGS</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-4 bg-card-elevated rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Medal className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">Session</div>
                  <div className="text-xs text-muted-foreground">Current Game</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-primary">#{stats.session_rank}</div>
                <div className="text-xs text-muted-foreground">of {stats.total_session_players}</div>
              </div>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-card-elevated rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Medal className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">Country</div>
                  <div className="text-xs text-muted-foreground">{stats.country_code}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-primary">#{stats.country_rank}</div>
                <div className="text-xs text-muted-foreground">of {stats.total_country_players.toLocaleString()}</div>
              </div>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-card-elevated rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Medal className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">Global</div>
                  <div className="text-xs text-muted-foreground">Worldwide</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-primary">#{stats.global_rank}</div>
                <div className="text-xs text-muted-foreground">of {stats.total_global_players.toLocaleString()}</div>
              </div>
            </div>
          </div>
          
          {stats.matches_played && (
            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Matches Played</span>
                <span className="text-sm font-bold">{stats.matches_played}</span>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  // Use Drawer for mobile and Dialog for desktop
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="text-xl font-bold flex items-center justify-between">
              My Statistics
              <DrawerClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="w-4 h-4" />
                </Button>
              </DrawerClose>
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 py-6 overflow-y-auto">
            {statsContent}
          </div>
          <DrawerFooter className="pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">My Statistics</DialogTitle>
          <DialogDescription>
            View your performance stats and rankings
          </DialogDescription>
        </DialogHeader>
        {statsContent}
      </DialogContent>
    </Dialog>
  );
};
