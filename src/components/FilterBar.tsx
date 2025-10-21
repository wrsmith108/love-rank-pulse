import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FilterBarProps {
  timePeriod: string;
  onTimePeriodChange: (value: string) => void;
  isLive?: boolean;
}

export const FilterBar = ({ timePeriod, onTimePeriodChange, isLive }: FilterBarProps) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Time Period:</span>
        <Select value={timePeriod} onValueChange={onTimePeriodChange}>
          <SelectTrigger className="w-40 bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="session">Current Session</SelectItem>
            <SelectItem value="hour">Last Hour</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLive && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
          <span className="text-sm font-medium text-success">Live</span>
        </div>
      )}
    </div>
  );
};
