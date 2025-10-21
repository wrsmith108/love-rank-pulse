import { useState } from "react";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { LeaderboardTable, Player } from "@/components/LeaderboardTable";
import { MyStatsModal } from "@/components/MyStatsModal";

// Mock data for demonstration
const mockPlayers: Player[] = [
  { player_id: "1", player_name: "ShadowStriker", country_code: "US", kills: 28, deaths: 8, kd_ratio: 3.50, is_win: true, rank: 1 },
  { player_id: "2", player_name: "NightHawk", country_code: "GB", kills: 25, deaths: 10, kd_ratio: 2.50, is_win: true, rank: 2 },
  { player_id: "3", player_name: "PhantomAce", country_code: "DE", kills: 22, deaths: 9, kd_ratio: 2.44, is_win: true, rank: 3 },
  { player_id: "4", player_name: "BlitzKrieg", country_code: "FR", kills: 24, deaths: 11, kd_ratio: 2.18, is_win: false, rank: 4 },
  { player_id: "5", player_name: "VortexPro", country_code: "JP", kills: 20, deaths: 10, kd_ratio: 2.00, is_win: true, rank: 5 },
  { player_id: "6", player_name: "IronSight", country_code: "CA", kills: 19, deaths: 10, kd_ratio: 1.90, is_win: false, rank: 6 },
  { player_id: "7", player_name: "TacticalOps", country_code: "AU", kills: 18, deaths: 10, kd_ratio: 1.80, is_win: true, rank: 7 },
  { player_id: "8", player_name: "StealthMode", country_code: "KR", kills: 17, deaths: 10, kd_ratio: 1.70, is_win: false, rank: 8 },
  { player_id: "9", player_name: "ReaperMain", country_code: "BR", kills: 16, deaths: 10, kd_ratio: 1.60, is_win: true, rank: 9 },
  { player_id: "10", player_name: "CyberNinja", country_code: "SE", kills: 15, deaths: 10, kd_ratio: 1.50, is_win: false, rank: 10 },
  { player_id: "current", player_name: "You", country_code: "US", kills: 14, deaths: 12, kd_ratio: 1.17, is_win: true, rank: 15 },
];

const mockPlayerStats = {
  player_name: "You",
  country_code: "US",
  kd_ratio: 1.17,
  kills: 156,
  deaths: 133,
  wins: 12,
  losses: 7,
  win_rate: 63,
  session_rank: 15,
  country_rank: 234,
  global_rank: 1234,
  total_session_players: 100,
  total_country_players: 1847,
  total_global_players: 10000,
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<"session" | "country" | "global">("session");
  const [timePeriod, setTimePeriod] = useState("session");
  const [showMyStats, setShowMyStats] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onMyStatsClick={() => setShowMyStats(true)}
      />

      <main className="container mx-auto px-4 py-6">
        {/* Session Info Banner */}
        {activeTab === "session" && (
          <div className="mb-4 p-4 bg-card-elevated rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Current Match</div>
                <div className="text-lg font-bold text-primary">Session #4721</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
                <span className="text-sm font-medium text-success">Live</span>
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar (only for Country and Global) */}
        {(activeTab === "country" || activeTab === "global") && (
          <FilterBar
            timePeriod={timePeriod}
            onTimePeriodChange={setTimePeriod}
            isLive={false}
          />
        )}

        {/* Your Position Banner (if not in top 100) */}
        <div className="mb-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="text-center">
            <span className="text-sm text-muted-foreground">Your Position: </span>
            <span className="text-lg font-bold text-primary">
              #{mockPlayerStats.session_rank} of {mockPlayerStats.total_session_players}
            </span>
          </div>
        </div>

        {/* Leaderboard */}
        <LeaderboardTable players={mockPlayers} currentPlayerId="current" />

        {/* Load More */}
        <div className="mt-6 text-center">
          <button className="px-6 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-lg transition-all">
            Load More
          </button>
        </div>
      </main>

      {/* My Stats Modal */}
      <MyStatsModal
        open={showMyStats}
        onOpenChange={setShowMyStats}
        stats={mockPlayerStats}
      />

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-border">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </footer>
    </div>
  );
};

export default Index;
