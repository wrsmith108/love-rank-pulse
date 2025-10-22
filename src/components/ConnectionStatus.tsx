import * as React from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConnectionState = "connected" | "connecting" | "reconnecting" | "disconnected" | "error";

interface ConnectionStatusProps {
  state: ConnectionState;
  onReconnect?: () => void;
  className?: string;
  lastPingTime?: number;
}

export const ConnectionStatus = ({
  state,
  onReconnect,
  className,
  lastPingTime
}: ConnectionStatusProps) => {
  const [showDetails, setShowDetails] = React.useState(false);

  const getStatusConfig = () => {
    switch (state) {
      case "connected":
        return {
          icon: Wifi,
          color: "text-success",
          bgColor: "bg-success/10",
          borderColor: "border-success/20",
          label: "Connected",
          pulse: false
        };
      case "connecting":
        return {
          icon: RefreshCw,
          color: "text-primary",
          bgColor: "bg-primary/10",
          borderColor: "border-primary/20",
          label: "Connecting",
          pulse: true
        };
      case "reconnecting":
        return {
          icon: RefreshCw,
          color: "text-warning",
          bgColor: "bg-warning/10",
          borderColor: "border-warning/20",
          label: "Reconnecting",
          pulse: true
        };
      case "disconnected":
      case "error":
        return {
          icon: WifiOff,
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          borderColor: "border-destructive/20",
          label: "Disconnected",
          pulse: false
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-50 transition-all duration-300",
        className
      )}
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-full border shadow-lg backdrop-blur-sm",
        config.bgColor,
        config.borderColor,
        "transition-all duration-200"
      )}>
        {/* Status indicator dot */}
        <div className={cn(
          "w-2 h-2 rounded-full",
          config.color.replace('text-', 'bg-'),
          config.pulse && "animate-pulse"
        )} />

        {/* Icon */}
        <Icon className={cn(
          "w-4 h-4",
          config.color,
          config.pulse && "animate-spin"
        )} />

        {/* Label - shown on hover or when disconnected */}
        <span className={cn(
          "text-xs font-medium transition-all duration-200",
          config.color,
          showDetails || state !== "connected" ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
        )}>
          {config.label}
        </span>

        {/* Reconnect button for disconnected state */}
        {(state === "disconnected" || state === "error") && onReconnect && (
          <button
            onClick={onReconnect}
            className={cn(
              "ml-1 text-xs px-2 py-0.5 rounded hover:bg-white/20 transition-colors",
              config.color
            )}
            aria-label="Reconnect"
          >
            Retry
          </button>
        )}
      </div>

      {/* Expanded details on hover */}
      {showDetails && state === "connected" && lastPingTime && (
        <div className={cn(
          "absolute top-full right-0 mt-2 px-3 py-2 rounded-lg border shadow-lg backdrop-blur-sm",
          "bg-card border-border",
          "min-w-[200px] text-xs text-muted-foreground"
        )}>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-success font-medium">Active</span>
            </div>
            <div className="flex justify-between">
              <span>Last ping:</span>
              <span className="font-mono">{lastPingTime}ms</span>
            </div>
            <div className="flex justify-between">
              <span>Protocol:</span>
              <span className="font-mono">WebSocket</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Hook for managing connection status
export const useConnectionStatus = (url?: string) => {
  const [state, setState] = React.useState<ConnectionState>("disconnected");
  const [lastPingTime, setLastPingTime] = React.useState<number>(0);
  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout>();

  const connect = React.useCallback(() => {
    if (!url) return;

    setState("connecting");

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      const pingStart = Date.now();

      ws.onopen = () => {
        setState("connected");
        setLastPingTime(Date.now() - pingStart);
      };

      ws.onclose = () => {
        setState("disconnected");
        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          setState("reconnecting");
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        setState("error");
      };
    } catch (error) {
      setState("error");
    }
  }, [url]);

  const disconnect = React.useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setState("disconnected");
  }, []);

  const reconnect = React.useCallback(() => {
    disconnect();
    connect();
  }, [connect, disconnect]);

  React.useEffect(() => {
    if (url) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [url, connect, disconnect]);

  return { state, lastPingTime, reconnect };
};
