import type { ConnectionTracker } from "./connection.js";

export class HeartbeatService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly tracker: ConnectionTracker,
    private readonly intervalMs: number = 30_000,
    private readonly onDeadConnection?: (connectionId: string, playerId?: string) => void
  ) {}

  public start(): void {
    if (this.running) return;
    this.running = true;

    this.timer = setInterval(() => {
      this.checkConnections();
    }, this.intervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  public checkConnections(): void {
    const connections = this.tracker.getAll();

    for (const conn of connections) {
      if (!conn.isAlive) {
        // Socket failed to reply to previous ping within interval
        const { connectionId, playerId } = conn;
        conn.terminate();
        this.tracker.remove(connectionId);
        if (this.onDeadConnection) {
          this.onDeadConnection(connectionId, playerId);
        }
        continue;
      }

      // Mark alive as false and send ping
      conn.isAlive = false;
      try {
        if (conn.socket.readyState === 1 /* WebSocket.OPEN */) {
          conn.socket.ping();
        }
      } catch {
        conn.terminate();
        this.tracker.remove(conn.connectionId);
      }
    }
  }

  public stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
