import { Trophy, User, Menu, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "./AuthModal";

interface HeaderProps {
  activeTab: "session" | "country" | "global";
  onTabChange: (tab: "session" | "country" | "global") => void;
  onMyStatsClick: () => void;
}

export const Header = ({ activeTab, onTabChange, onMyStatsClick }: HeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const isMobile = useIsMobile();
  const { isAuthenticated, currentUser, logout } = useAuth();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  
  const handleAuthAction = () => {
    if (isAuthenticated) {
      logout();
    } else {
      setShowAuthModal(true);
    }
  };
  
  const handleMyStatsClick = () => {
    onMyStatsClick();
  };

  return (
    <>
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
      />
      
      <header className="sticky top-0 z-50 bg-card border-b border-border backdrop-blur-sm bg-opacity-95">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-gradient bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-foreground">Love Rank Pulse</h1>
          </div>

          {/* Desktop Navigation */}
          {!isMobile && (
            <>
              {/* Tab Navigation */}
              <nav className="flex gap-1 bg-secondary rounded-lg p-1">
                <button
                  onClick={() => onTabChange("session")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === "session"
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="View session leaderboard"
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
                  aria-label="View country leaderboard"
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
                  aria-label="View global leaderboard"
                >
                  Global
                </button>
              </nav>

              <div className="flex items-center gap-2">
                {/* My Stats Button */}
                <Button
                  onClick={handleMyStatsClick}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  aria-label="View my statistics"
                >
                  <User className="w-4 h-4 mr-2" />
                  My Stats
                </Button>
                
                {/* Login/Logout Button */}
                <Button
                  onClick={handleAuthAction}
                  variant="outline"
                  className="font-semibold"
                  aria-label={isAuthenticated ? "Logout" : "Login"}
                >
                  {isAuthenticated ? (
                    <>
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 mr-2" />
                      Login
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Mobile Menu Button */}
          {isMobile && (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleMyStatsClick}
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="View my statistics"
              >
                <User className="w-5 h-5 text-primary" />
              </Button>
              
              <Button
                onClick={handleAuthAction}
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label={isAuthenticated ? "Logout" : "Login"}
              >
                {isAuthenticated ? (
                  <LogOut className="w-5 h-5 text-primary" />
                ) : (
                  <LogIn className="w-5 h-5 text-primary" />
                )}
              </Button>
              
              <Button
                onClick={toggleMobileMenu}
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Navigation Menu */}
        {isMobile && mobileMenuOpen && (
          <div className="mt-4 bg-card-elevated rounded-lg shadow-lg border border-border overflow-hidden">
            <nav className="flex flex-col divide-y divide-border">
              <button
                onClick={() => {
                  onTabChange("session");
                  setMobileMenuOpen(false);
                }}
                className={`px-4 py-3 text-left text-sm font-medium ${
                  activeTab === "session" ? "bg-primary/10 text-primary" : "text-foreground"
                }`}
              >
                Session Leaderboard
              </button>
              <button
                onClick={() => {
                  onTabChange("country");
                  setMobileMenuOpen(false);
                }}
                className={`px-4 py-3 text-left text-sm font-medium ${
                  activeTab === "country" ? "bg-primary/10 text-primary" : "text-foreground"
                }`}
              >
                Country Leaderboard
              </button>
              <button
                onClick={() => {
                  onTabChange("global");
                  setMobileMenuOpen(false);
                }}
                className={`px-4 py-3 text-left text-sm font-medium ${
                  activeTab === "global" ? "bg-primary/10 text-primary" : "text-foreground"
                }`}
              >
                Global Leaderboard
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
    </>
  );
};
