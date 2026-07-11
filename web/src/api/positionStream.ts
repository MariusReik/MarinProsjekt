import { Client, type IMessage } from "@stomp/stompjs";
import type { Position } from "./types";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface PositionStreamHandlers {
  /** Called with each batch of positions pushed to /topic/positions. */
  onPositions: (positions: Position[]) => void;
  /** Called whenever the connection state changes. */
  onStatusChange: (status: ConnectionStatus) => void;
}

/** STOMP destination the API broadcasts to (PositionBroadcastService, #8). */
const POSITIONS_TOPIC = "/topic/positions";

/**
 * Builds the ws(s) URL for the STOMP endpoint from the current origin, so it
 * works behind the Vite dev proxy and the production reverse proxy alike
 * (both expose the API's /ws on the same origin as the app).
 */
function brokerUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}

/**
 * Live position stream over STOMP-over-WebSocket (issue #8). Wraps
 * @stomp/stompjs, which handles automatic reconnect with backoff and heartbeat.
 * No SockJS fallback — matches the API decision (#8) to target native
 * WebSocket only.
 *
 * Returns a disposer that deactivates the client. Safe to call in a React
 * effect cleanup (including StrictMode's double-invoke in dev).
 */
export function connectPositionStream(handlers: PositionStreamHandlers): () => void {
  const client = new Client({
    brokerURL: brokerUrl(),
    // Reconnect + heartbeat so a transient API restart heals itself instead of
    // silently freezing the map.
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      handlers.onStatusChange("connected");
      client.subscribe(POSITIONS_TOPIC, (message: IMessage) => {
        try {
          const positions = JSON.parse(message.body) as Position[];
          if (Array.isArray(positions) && positions.length > 0) {
            handlers.onPositions(positions);
          }
        } catch (err) {
          // A single malformed frame must not tear down the stream.
          console.error("[stream] failed to parse positions frame", err);
        }
      });
    },
    onWebSocketClose: () => handlers.onStatusChange("disconnected"),
    onStompError: (frame) => {
      console.error("[stream] STOMP error", frame.headers["message"], frame.body);
      handlers.onStatusChange("disconnected");
    },
  });

  handlers.onStatusChange("connecting");
  client.activate();

  return () => {
    // deactivate() returns a promise; we don't need to await it in cleanup.
    void client.deactivate();
  };
}
