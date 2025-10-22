import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Clock, Filter, RefreshCw, SlidersHorizontal, Globe } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export type TimePeriod = "session" | "hour" | "today" | "week" | "month" | "all";
export type SortOption = "rank" | "kd" | "kills" | "wins";

// Popular countries for quick selection
const POPULAR_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "BR", name: "Brazil" },
];

interface FilterBarProps {
  timePeriod: TimePeriod;
  onTimePeriodChange: (value: TimePeriod) => void;
  isLive?: boolean;
  sortBy?: SortOption;
  onSortChange?: (value: SortOption) => void;
  onRefresh?: () => void;
  showOnlyFriends?: boolean;
  onToggleFriends?: (value: boolean) => void;
  activeTab?: "session" | "country" | "global";
  countryCode?: string;
  onCountryChange?: (code: string) => void;
}

export const FilterBar = ({
  timePeriod,
  onTimePeriodChange,
  isLive = false,
  sortBy = "rank",
  onSortChange = () => {},
  onRefresh = () => {},
  showOnlyFriends = false,
  onToggleFriends = () => {},
  activeTab = "global",
  countryCode = "US",
  onCountryChange = () => {}
}: FilterBarProps) => {
  const isMobile = useIsMobile();
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [countrySearch, setCountrySearch] = React.useState("");

  const filteredCountries = POPULAR_COUNTRIES.filter(country =>
    country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    country.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Country Selector - Only show for country tab */}
        {activeTab === "country" && (
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <Select value={countryCode} onValueChange={onCountryChange}>
              <SelectTrigger className={`${isMobile ? 'w-32' : 'w-40'} bg-secondary border-border`}>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 pb-2">
                  <Input
                    placeholder="Search country..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                {filteredCountries.length > 0 ? (
                  filteredCountries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.code} - {country.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No countries found
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Time Period Selector */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <Select value={timePeriod} onValueChange={(value) => onTimePeriodChange(value as TimePeriod)}>
            <SelectTrigger className={`${isMobile ? 'w-32' : 'w-40'} bg-secondary border-border`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="session">Current Session</SelectItem>
              <SelectItem value="hour">Last Hour</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort Options - Desktop */}
        {!isMobile && (
          <div className="flex items-center gap-2">
            <Separator orientation="vertical" className="h-6" />
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortOption)}>
              <SelectTrigger className="w-32 bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rank">Rank</SelectItem>
                <SelectItem value="kd">K/D Ratio</SelectItem>
                <SelectItem value="kills">Kills</SelectItem>
                <SelectItem value="wins">Wins</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Friends Toggle - Desktop */}
        {!isMobile && (
          <div className="flex items-center gap-2">
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Switch
                id="friends-only"
                checked={showOnlyFriends}
                onCheckedChange={onToggleFriends}
              />
              <Label htmlFor="friends-only" className="text-sm cursor-pointer">
                Friends Only
              </Label>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Live Indicator */}
        {isLive && (
          <div className="flex items-center gap-2 mr-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium text-success">Live</span>
          </div>
        )}

        {/* Refresh Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          className="rounded-full h-8 w-8"
          aria-label="Refresh leaderboard"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>

        {/* Mobile Filter Button */}
        {isMobile && (
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                aria-label="Show filter options"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filters</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
              <div className="space-y-4">
                <h4 className="font-medium">Filter Options</h4>

                {/* Country Selector - Mobile */}
                {activeTab === "country" && (
                  <div className="space-y-2">
                    <Label htmlFor="mobile-country">Country</Label>
                    <Select value={countryCode} onValueChange={onCountryChange}>
                      <SelectTrigger id="mobile-country" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 pb-2">
                          <Input
                            placeholder="Search country..."
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        {filteredCountries.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.code} - {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Sort Options */}
                <div className="space-y-2">
                  <Label htmlFor="mobile-sort">Sort by</Label>
                  <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortOption)}>
                    <SelectTrigger id="mobile-sort" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rank">Rank</SelectItem>
                      <SelectItem value="kd">K/D Ratio</SelectItem>
                      <SelectItem value="kills">Kills</SelectItem>
                      <SelectItem value="wins">Wins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Friends Toggle */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="mobile-friends-only">Friends Only</Label>
                  <Switch
                    id="mobile-friends-only"
                    checked={showOnlyFriends}
                    onCheckedChange={onToggleFriends}
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => setIsFilterOpen(false)}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};
