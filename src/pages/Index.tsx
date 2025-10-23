import * as React from "react";
import { Header } from "@/components/Header";
import { FilterBar, TimePeriod, SortOption } from "@/components/FilterBar";
import { LeaderboardTable, Player } from "@/components/LeaderboardTable";
import { MyStatsModal, PlayerStats } from "@/components/MyStatsModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWebSocket } from "@/contexts/WebSocketContext";

// Enhanced mock data for demonstration
const mockSessionPlayers: Player[] = [
  {
    player_id: "1",
    player_name: "ShadowStriker",
    country_code: "US",
    kills: 328,
    deaths: 78,
    kd_ratio: 4.21,
    is_win: true,
    rank: 1,
    headshots: 156,
    accuracy: 68,
    score: 9850
  },
  {
    player_id: "2",
    player_name: "NightHawk",
    country_code: "GB",
    kills: 295,
    deaths: 110,
    kd_ratio: 2.68,
    is_win: true,
    rank: 2,
    headshots: 98,
    accuracy: 62,
    score: 8720
  },
  {
    player_id: "3",
    player_name: "PhantomAce",
    country_code: "DE",
    kills: 272,
    deaths: 109,
    kd_ratio: 2.50,
    is_win: true,
    rank: 3,
    headshots: 124,
    accuracy: 71,
    score: 8450
  },
  {
    player_id: "4",
    player_name: "BlitzKrieg",
    country_code: "FR",
    kills: 254,
    deaths: 121,
    kd_ratio: 2.10,
    is_win: false,
    rank: 4,
    headshots: 87,
    accuracy: 58,
    score: 7920
  },
  {
    player_id: "5",
    player_name: "VortexPro",
    country_code: "JP",
    kills: 230,
    deaths: 115,
    kd_ratio: 2.00,
    is_win: true,
    rank: 5,
    headshots: 92,
    accuracy: 64,
    score: 7650
  },
  {
    player_id: "6",
    player_name: "IronSight",
    country_code: "CA",
    kills: 219,
    deaths: 120,
    kd_ratio: 1.83,
    is_win: false,
    rank: 6,
    headshots: 78,
    accuracy: 59,
    score: 7320
  },
  {
    player_id: "7",
    player_name: "TacticalOps",
    country_code: "AU",
    kills: 208,
    deaths: 118,
    kd_ratio: 1.76,
    is_win: true,
    rank: 7,
    headshots: 65,
    accuracy: 61,
    score: 7180
  },
  {
    player_id: "8",
    player_name: "StealthMode",
    country_code: "KR",
    kills: 197,
    deaths: 116,
    kd_ratio: 1.70,
    is_win: false,
    rank: 8,
    headshots: 71,
    accuracy: 57,
    score: 6950
  },
  {
    player_id: "9",
    player_name: "ReaperMain",
    country_code: "BR",
    kills: 186,
    deaths: 112,
    kd_ratio: 1.66,
    is_win: true,
    rank: 9,
    headshots: 59,
    accuracy: 55,
    score: 6780
  },
  {
    player_id: "10",
    player_name: "CyberNinja",
    country_code: "SE",
    kills: 175,
    deaths: 115,
    kd_ratio: 1.52,
    is_win: false,
    rank: 10,
    headshots: 48,
    accuracy: 52,
    score: 6540
  },
  {
    player_id: "current",
    player_name: "You",
    country_code: "US",
    kills: 164,
    deaths: 142,
    kd_ratio: 1.15,
    is_win: true,
    rank: 15,
    headshots: 42,
    accuracy: 49,
    score: 5980
  },
];

// Country leaderboard - filtered to US players only
const mockCountryPlayers: Player[] = [
  {
    player_id: "1",
    player_name: "ShadowStriker",
    country_code: "US",
    kills: 2845,
    deaths: 892,
    kd_ratio: 3.19,
    is_win: true,
    rank: 1,
    headshots: 1234,
    accuracy: 67,
    score: 89500
  },
  {
    player_id: "6",
    player_name: "IronSight",
    country_code: "US",
    kills: 2219,
    deaths: 1020,
    kd_ratio: 2.17,
    is_win: false,
    rank: 2,
    headshots: 987,
    accuracy: 61,
    score: 73200
  },
  {
    player_id: "11",
    player_name: "EagleEye",
    country_code: "US",
    kills: 2104,
    deaths: 1145,
    kd_ratio: 1.84,
    is_win: true,
    rank: 3,
    headshots: 856,
    accuracy: 58,
    score: 68400
  },
  {
    player_id: "12",
    player_name: "TexasRanger",
    country_code: "US",
    kills: 1987,
    deaths: 1198,
    kd_ratio: 1.66,
    is_win: false,
    rank: 4,
    headshots: 723,
    accuracy: 54,
    score: 62100
  },
  {
    player_id: "13",
    player_name: "StateSide",
    country_code: "US",
    kills: 1876,
    deaths: 1234,
    kd_ratio: 1.52,
    is_win: true,
    rank: 5,
    headshots: 689,
    accuracy: 52,
    score: 58900
  },
  {
    player_id: "current",
    player_name: "You",
    country_code: "US",
    kills: 1564,
    deaths: 1356,
    kd_ratio: 1.15,
    is_win: true,
    rank: 234,
    headshots: 428,
    accuracy: 49,
    score: 49800
  },
];

// Global leaderboard - top players worldwide
const mockGlobalPlayers: Player[] = [
  {
    player_id: "g1",
    player_name: "GlobalElite",
    country_code: "KR",
    kills: 8945,
    deaths: 1234,
    kd_ratio: 7.25,
    is_win: true,
    rank: 1,
    headshots: 4567,
    accuracy: 78,
    score: 245000
  },
  {
    player_id: "g2",
    player_name: "ProGamer",
    country_code: "SE",
    kills: 7823,
    deaths: 1456,
    kd_ratio: 5.37,
    is_win: true,
    rank: 2,
    headshots: 3892,
    accuracy: 74,
    score: 218000
  },
  {
    player_id: "g3",
    player_name: "LegendKiller",
    country_code: "JP",
    kills: 7456,
    deaths: 1678,
    kd_ratio: 4.44,
    is_win: false,
    rank: 3,
    headshots: 3421,
    accuracy: 71,
    score: 198500
  },
  {
    player_id: "g4",
    player_name: "AceMaster",
    country_code: "DE",
    kills: 6892,
    deaths: 1823,
    kd_ratio: 3.78,
    is_win: true,
    rank: 4,
    headshots: 3156,
    accuracy: 68,
    score: 176400
  },
  {
    player_id: "g5",
    player_name: "WarLord",
    country_code: "BR",
    kills: 6234,
    deaths: 1987,
    kd_ratio: 3.14,
    is_win: true,
    rank: 5,
    headshots: 2845,
    accuracy: 65,
    score: 159800
  },
  {
    player_id: "g6",
    player_name: "TitanSlayer",
    country_code: "CN",
    kills: 5987,
    deaths: 2145,
    kd_ratio: 2.79,
    is_win: false,
    rank: 6,
    headshots: 2678,
    accuracy: 63,
    score: 148200
  },
  {
    player_id: "g7",
    player_name: "ShadowStriker",
    country_code: "US",
    kills: 5678,
    deaths: 2234,
    kd_ratio: 2.54,
    is_win: true,
    rank: 7,
    headshots: 2489,
    accuracy: 61,
    score: 139600
  },
  {
    player_id: "current",
    player_name: "You",
    country_code: "US",
    kills: 1564,
    deaths: 1356,
    kd_ratio: 1.15,
    is_win: true,
    rank: 1234,
    headshots: 428,
    accuracy: 49,
    score: 49800
  },
];

const mockPlayerStats: PlayerStats = {
  player_name: "You",
  country_code: "US",
  kd_ratio: 1.15,
  kills: 1564,
  deaths: 1356,
  wins: 124,
  losses: 73,
  win_rate: 63,
  session_rank: 15,
  country_rank: 234,
  global_rank: 1234,
  total_session_players: 100,
  total_country_players: 1847,
  total_global_players: 10000,
  // Additional stats
  headshots: 428,
  accuracy: 49,
  playtime: 1240, // in minutes
  highest_killstreak: 12,
  favorite_weapon: "AK-47 Tactical",
  weapon_accuracy: 52,
  recent_performance: "improving",
  matches_played: 197
};

const Index = () => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = React.useState<"session" | "country" | "global">("session");
  const [timePeriod, setTimePeriod] = React.useState<TimePeriod>("session");
  const [showMyStats, setShowMyStats] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<SortOption>("rank");
  const [showOnlyFriends, setShowOnlyFriends] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [players, setPlayers] = React.useState<Player[]>(mockSessionPlayers);
  const [currentSessionId] = React.useState("4721");
  const [countryCode, setCountryCode] = React.useState("US");
  const [displayCount, setDisplayCount] = React.useState(10);

  // WebSocket connection
  const { isConnected, connectionState } = useWebSocket();

  // Map WebSocket connection state to ConnectionStatus state
  const getConnectionStatusState = () => {
    if (!connectionState) return "disconnected";

    switch (connectionState) {
      case "connected":
        return "connected";
      case "connecting":
        return "connecting";
      case "reconnecting":
        return "reconnecting";
      case "disconnected":
        return "disconnected";
      default:
        return "disconnected";
    }
  };

  // Get subscription scope based on active tab
  const getSubscriptionScope = React.useCallback((): string => {
    switch (activeTab) {
      case "session":
        return `session:${currentSessionId}`;
      case "country":
        return `country:${countryCode}`;
      case "global":
      default:
        return "global";
    }
  }, [activeTab, currentSessionId, countryCode]);

  // Handle retry
  const handleRetry = () => {
    setError(null);
    setIsLoading(true);

    // Simulate data refresh based on active tab
    setTimeout(() => {
      switch (activeTab) {
        case "session":
          setPlayers(mockSessionPlayers);
          break;
        case "country":
          setPlayers(mockCountryPlayers);
          break;
        case "global":
          setPlayers(mockGlobalPlayers);
          break;
      }
      setIsLoading(false);
    }, 1000);
  };

  // Handle tab change
  const handleTabChange = (tab: "session" | "country" | "global") => {
    setActiveTab(tab);
    setError(null);
    setIsLoading(true);
    setDisplayCount(10); // Reset pagination when changing tabs

    // Load appropriate data based on tab
    setTimeout(() => {
      switch (tab) {
        case "session":
          setPlayers(mockSessionPlayers);
          break;
        case "country":
          setPlayers(mockCountryPlayers);
          break;
        case "global":
          setPlayers(mockGlobalPlayers);
          break;
      }
      setIsLoading(false);
    }, 300);
  };

  // WebSocket is connected via useWebSocket hook above
  // Real-time updates are handled by useWebSocketSync in the background

  // Sorting logic for players
  const getSortedPlayers = React.useMemo(() => {
    let sorted = [...players];

    switch (sortBy) {
      case 'kd':
        sorted.sort((a, b) => b.kd_ratio - a.kd_ratio);
        break;
      case 'kills':
        sorted.sort((a, b) => b.kills - a.kills);
        break;
      case 'deaths':
        sorted.sort((a, b) => a.deaths - b.deaths);
        break;
      case 'rank':
      default:
        sorted.sort((a, b) => a.rank - b.rank);
        break;
    }

    return sorted;
  }, [players, sortBy]);

  return (
    <ErrorBoundary onReset={handleRetry}>
      <div className="min-h-screen bg-background">
        {/* Connection Status Indicator */}
        <ConnectionStatus
          state={getConnectionStatusState() as any}
          onReconnect={() => window.location.reload()}
        />

        <Header
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onMyStatsClick={() => setShowMyStats(true)}
        />

        <main className="container mx-auto px-4 py-6">
          {/* Session Info Banner */}
          {activeTab === "session" && (
            <div className="mb-4 p-4 bg-card-elevated rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Current Match</div>
                  <div className="text-lg font-bold text-primary">Session #{currentSessionId}</div>
                </div>
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
                      <span className="text-sm font-medium text-success">Live</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-muted" />
                      <span className="text-sm font-medium text-muted-foreground">
                        {connectionState}
                      </span>
                    </>
                  )}
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
              sortBy={sortBy}
              onSortChange={setSortBy}
              showOnlyFriends={showOnlyFriends}
              onToggleFriends={setShowOnlyFriends}
              activeTab={activeTab}
              countryCode={countryCode}
              onCountryChange={setCountryCode}
              onRefresh={handleRetry}
            />
          )}

          {/* Your Position Banner (if not in top 100) */}
          <div className="mb-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="text-center">
              <span className="text-sm text-muted-foreground">Your Position: </span>
              <span className="text-lg font-bold text-primary">
                #{activeTab === "session" ? mockPlayerStats.session_rank :
                  activeTab === "country" ? mockPlayerStats.country_rank :
                  mockPlayerStats.global_rank} of{" "}
                {activeTab === "session" ? mockPlayerStats.total_session_players :
                 activeTab === "country" ? mockPlayerStats.total_country_players :
                 mockPlayerStats.total_global_players}
              </span>
            </div>
          </div>

          {/* Leaderboard */}
          <LeaderboardTable
            players={getSortedPlayers.slice(0, displayCount)}
            currentPlayerId="current"
            isLoading={isLoading}
            error={error}
            onRetry={handleRetry}
          />

          {/* Load More */}
          {displayCount < getSortedPlayers.length && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setDisplayCount(prev => Math.min(prev + 10, getSortedPlayers.length))}
                data-testid="load-more-button"
                className="px-6 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-lg transition-all"
              >
                Load More ({getSortedPlayers.length - displayCount} remaining)
              </button>
            </div>
          )}
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
            {isConnected ? (
              <>
                Live updates • Scope: {getSubscriptionScope()} • Connected
              </>
            ) : (
              <>
                Scope: {getSubscriptionScope()} • Last updated: {new Date().toLocaleTimeString()}
              </>
            )}
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
};

export default Index;
