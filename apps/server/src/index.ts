import Fastify, { type FastifyInstance } from "fastify";
import { ROOM_CLEANUP_INTERVAL_MS, ROOM_IDLE_TIMEOUT_MS } from "./config/constants.js";
import { type ServerConfig, config as defaultConfig, loadConfig } from "./config/env.js";
import { InMemorySessionStore } from "./auth/session.js";
import { registerHttpRoutes } from "./http/routes.js";
import { RoomManager } from "./rooms/RoomManager.js";
import { type WebSocketServiceContext, registerWebSocket } from "./websocket/register.js";
import { createDefaultGameRegistry, type GameAdapterRegistry } from "./games/index.js";

export interface ServerInstance {
  app: FastifyInstance;
  roomManager: RoomManager;
  sessionStore: InMemorySessionStore;
  wsContext: WebSocketServiceContext;
  gameRegistry: GameAdapterRegistry;
  stop: () => Promise<void>;
}

export async function buildApp(
  customConfig?: Partial<ServerConfig>
): Promise<ServerInstance> {
  const config = { ...defaultConfig, ...customConfig };

  const app = Fastify({
    logger: config.nodeEnv === "test" ? false : {
      level: config.logLevel,
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
  });

  const sessionStore = new InMemorySessionStore();
  const roomManager = new RoomManager(config.disconnectGracePeriodMs);
  const gameRegistry = createDefaultGameRegistry();

  // Register HTTP routes
  await registerHttpRoutes(app);

  // Register WebSocket route
  const wsContext = await registerWebSocket(app, {
    config,
    sessionStore,
    roomManager,
    gameRegistry,
  });

  // Stale room cleanup timer
  const cleanupTimer = setInterval(() => {
    const cleaned = roomManager.cleanupStaleRooms(ROOM_IDLE_TIMEOUT_MS);
    if (cleaned > 0) {
      app.log.info({ cleaned }, "Cleaned up idle rooms");
    }
  }, ROOM_CLEANUP_INTERVAL_MS);

  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  const stop = async (): Promise<void> => {
    clearInterval(cleanupTimer);
    wsContext.heartbeatService.stop();
    wsContext.connectionTracker.clear();
    roomManager.destroy();
    await app.close();
  };

  return {
    app,
    roomManager,
    sessionStore,
    wsContext,
    gameRegistry,
    stop,
  };
}

export async function startServer(): Promise<ServerInstance> {
  const config = loadConfig();
  const server = await buildApp(config);

  const shutdown = async (signal: string) => {
    server.app.log.info({ signal }, "Received shutdown signal. Closing server gracefully...");
    try {
      await server.stop();
      server.app.log.info("Server shutdown completed");
      process.exit(0);
    } catch (err) {
      server.app.log.error({ err }, "Error during graceful shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  try {
    const address = await server.app.listen({
      port: config.port,
      host: config.host,
    });
    server.app.log.info({ address, port: config.port, host: config.host }, "OmniPlay server is running");
  } catch (err) {
    server.app.log.fatal({ err }, "Failed to start server");
    process.exit(1);
  }

  return server;
}

// Auto-start if executed directly
const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"));

if (isDirectExecution) {
  startServer().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
  });
}
