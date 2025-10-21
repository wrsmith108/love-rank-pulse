import { Trophy, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  activeTab: "session" | "country" | "global";
  onTabChange: (tab: "session" | "country" | "global") => void;
  onMyStatsClick: () => void;
}

export const Header = ({ activeTab, onTabChange, onMyStatsClick }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border backdrop-blur-sm bg-opacity-95">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-gradient">FPS Leaderboard</h1>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-1 bg-secondary rounded-lg p-1">
            <button
              onClick={() => onTabChange("session")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "session"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Session
            </button>
            <button
              onClick={() => onTabChange("country")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "country"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Country
            </button>
            <button
              onClick={() => onTabChange("global")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "global"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Global
            </button>
          </nav>

          {/* My Stats Button */}
          <Button
            onClick={onMyStatsClick}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <User className="w-4 h-4 mr-2" />
            My Stats
          </Button>
        </div>
      </div>
    </header>
  );
};
