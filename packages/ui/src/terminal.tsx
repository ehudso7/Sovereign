// ---------------------------------------------------------------------------
// Terminal — xterm.js-based terminal emulator component (Phase 15)
// ---------------------------------------------------------------------------

import React, { useEffect, useRef, useCallback } from "react";

/**
 * Props for the Terminal component.
 * Wraps xterm.js with WebSocket connectivity and mobile-optimized features.
 */
export interface TerminalProps {
  /** WebSocket URL for the terminal session */
  readonly wsUrl?: string;
  /** Called when a WebSocket connection is established */
  readonly onConnected?: () => void;
  /** Called when a WebSocket connection is lost */
  readonly onDisconnected?: () => void;
  /** Called when data is written by the user (for local mode without WebSocket) */
  readonly onData?: (data: string) => void;
  /** Terminal font size in pixels */
  readonly fontSize?: number;
  /** Number of columns (auto-detected from container if not set) */
  readonly cols?: number;
  /** Number of rows (auto-detected from container if not set) */
  readonly rows?: number;
  /** Additional CSS class names */
  readonly className?: string;
  /** Whether the terminal is read-only */
  readonly readOnly?: boolean;
}

/**
 * Lightweight terminal emulator placeholder component.
 *
 * In production, this integrates with xterm.js + @xterm/addon-fit +
 * @xterm/addon-web-links. The component establishes a WebSocket connection
 * to the terminal proxy service and bridges I/O.
 *
 * This implementation provides the React component shell and WebSocket
 * lifecycle. The actual xterm.js dependency is loaded dynamically to avoid
 * SSR issues in Next.js.
 */
export function Terminal({
  wsUrl,
  onConnected,
  onDisconnected,
  onData,
  fontSize = 14,
  className,
  readOnly = false,
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectWebSocket = useCallback(() => {
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      onConnected?.();
    };

    ws.onclose = () => {
      onDisconnected?.();
      // Auto-reconnect after 2 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event: MessageEvent) => {
      // In production: write data to xterm.js instance
      // term.write(event.data);
      void event;
    };
  }, [wsUrl, onConnected, onDisconnected]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (readOnly) return;
      if (e.key.length === 1) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(e.key);
        }
        onData?.(e.key);
      } else if (e.key === "Enter") {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send("\r");
        }
        onData?.("\r");
      } else if (e.key === "Backspace") {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send("\x7f");
        }
        onData?.("\x7f");
      }
    },
    [readOnly, onData],
  );

  return (
    <div
      ref={containerRef}
      role="textbox"
      tabIndex={0}
      aria-label="Terminal"
      onKeyDown={handleKeyDown}
      className={[
        "bg-black text-green-400 font-mono rounded-lg overflow-hidden",
        "focus:outline-none focus:ring-2 focus:ring-blue-500",
        "w-full h-full min-h-[300px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ fontSize: `${fontSize}px` }}
    >
      <div className="p-3 h-full flex flex-col">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-700 mb-2 shrink-0">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="ml-2 text-gray-500 text-xs">
            {wsUrl ? "connected" : "local"}
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <div className="text-sm leading-relaxed">
            <span className="text-blue-400">sovereign</span>
            <span className="text-gray-500">:</span>
            <span className="text-green-400">~</span>
            <span className="text-gray-500">$ </span>
            <span className="animate-pulse">_</span>
          </div>
        </div>
      </div>
    </div>
  );
}
