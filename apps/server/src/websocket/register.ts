import fastifyWebsocket from "@fastify/websocket";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket as WsWebSocket } from "ws";
import { MAX_PAYLOAD_BYTES, PROTOCOL_VERSION } from "../config/constants.js";
import type { ServerConfig } from "../config/env.js";
import type { InMemorySessionStore } from "../auth/session.js";
import type { RoomManager } from "../rooms/RoomManager.js";
import { isOriginAllowed } from "../security/origin.js";
import type { RoomUpdatedPayload } from "../types/index.js";
import { parseClientMessage } from "../validation/messages.js";
import { ConnectionTracker, PlayerConnection } from "./connection.js";
import { HeartbeatService } from "./heartbeat.js";
import { broadcastToRoom, handleClientMessage } from "./protocol.js";

import type { GameAdapterRegistry } from "../games/index.js";

export interface WebSocketServiceContext {
  connectionTracker: ConnectionTracker;
  heartbeatService: HeartbeatService;
}

export async function registerWebSocket(
  fastify: FastifyInstance,
  options: {
    config: ServerConfig;
    sessionStore: InMemorySessionStore;
    roomManager: RoomManager;
    gameRegistry?: GameAdapterRegistry;
  }
): Promise<WebSocketServiceContext> {
  const { config, sessionStore, roomManager, gameRegistry } = options;
  const connectionTracker = new ConnectionTracker();

  // Register fastify-websocket plugin with strict options
  await fastify.register(fastifyWebsocket, {
    options: {
      maxPayload: MAX_PAYLOAD_BYTES,
      perMessageDeflate: false,
      clientTracking: false,
    },
  });

  // Start heartbeat service
  const heartbeatService = new HeartbeatService(
    connectionTracker,
    config.heartbeatIntervalMs,
    (_connectionId, playerId) => {
      fastify.log.info({ playerId }, "Cleaned up dead WebSocket connection");
      if (playerId) {
        roomManager.handleDisconnect(playerId);
      }
    }
  );
  heartbeatService.start();

  // Register /ws route
  fastify.get(
    "/ws",
    {
      websocket: true,
      preHandler: async (req: FastifyRequest, reply) => {
        const origin = req.headers.origin;
        const allowMissing = config.nodeEnv !== "production";
        if (!isOriginAllowed(origin, config.allowedOrigins, allowMissing)) {
          fastify.log.warn({ origin }, "Rejected WebSocket connection with unauthorized origin");
          reply.code(403).send({ error: "Forbidden: Origin not allowed" });
          return reply;
        }
      },
    },
    // Handler accepts both SocketStream and raw WebSocket (defensive)
    (connection: unknown, req: FastifyRequest) => {
      const origin = req.headers.origin;
      const allowMissing = config.nodeEnv !== "production";
      if (!isOriginAllowed(origin, config.allowedOrigins, allowMissing)) {
        fastify.log.warn({ origin }, "Closing WebSocket for unpermitted origin in ws handler");
        const socket = (connection as { socket?: WsWebSocket }).socket ?? (connection as WsWebSocket);
        try {
          socket.close(4003, "Forbidden origin");
        } catch {
          socket.terminate();
        }
        return;
      }

      const socket: WsWebSocket =
        (connection as { socket?: WsWebSocket }).socket ?? (connection as WsWebSocket);

      const playerConn = new PlayerConnection(
        socket,
        config.rateLimitCapacity,
        config.rateLimitRefillPerSec
      );

      connectionTracker.add(playerConn);
      fastify.log.info({ connectionId: playerConn.connectionId }, "WebSocket client connected");

      socket.on("pong", () => {
        playerConn.isAlive = true;
      });

      socket.on("message", async (rawData: Buffer | string | ArrayBuffer | Buffer[]) => {
        playerConn.lastMessageAt = Date.now();
        playerConn.isAlive = true;

        // Rate limiting check
        if (!playerConn.rateLimiter.tryConsume()) {
          fastify.log.warn(
            { connectionId: playerConn.connectionId, playerId: playerConn.playerId },
            "Client exceeded rate limit"
          );
          playerConn.sendError("RATE_LIMITED", "Too many requests. Please slow down.");
          return;
        }

        // Parse and validate incoming message
        const parseResult = parseClientMessage(rawData);
        if (!parseResult.success) {
          fastify.log.debug(
            { connectionId: playerConn.connectionId, code: parseResult.code, error: parseResult.error },
            "Invalid client message received"
          );
          playerConn.sendError(parseResult.code, parseResult.error, parseResult.requestId);
          return;
        }

        // Process message safely
        try {
          await handleClientMessage(playerConn, parseResult.message, {
            sessionStore,
            roomManager,
            connectionTracker,
            logger: fastify.log,
            gameRegistry,
          });
        } catch (err) {
          fastify.log.error(
            { err, connectionId: playerConn.connectionId, messageType: parseResult.message.type },
            "Error processing client message"
          );
          playerConn.sendError(
            "INTERNAL_ERROR",
            "An internal error occurred while processing your request",
            parseResult.message.requestId
          );
        }
      });

      socket.on("close", (code, reason) => {
        fastify.log.info(
          { connectionId: playerConn.connectionId, playerId: playerConn.playerId, code, reason: reason?.toString() },
          "WebSocket connection closed"
        );

        connectionTracker.remove(playerConn.connectionId);

        if (playerConn.playerId) {
          const disconnectResult = roomManager.handleDisconnect(
            playerConn.playerId,
            (abandonedRoom) => {
              broadcastToRoom<RoomUpdatedPayload>(
                abandonedRoom,
                {
                  version: PROTOCOL_VERSION,
                  type: "room.updated",
                  payload: {
                    room: abandonedRoom.toDto(),
                    reason: "player_left",
                  },
                },
                connectionTracker
              );
            }
          );

          if (disconnectResult.room) {
            broadcastToRoom<RoomUpdatedPayload>(
              disconnectResult.room,
              {
                version: PROTOCOL_VERSION,
                type: "room.updated",
                payload: {
                  room: disconnectResult.room.toDto(),
                  reason: "player_disconnected",
                },
              },
              connectionTracker,
              playerConn.playerId
            );
          }
        }
      });

      socket.on("error", (err) => {
        fastify.log.warn({ err, connectionId: playerConn.connectionId }, "WebSocket error encountered");
      });
    }
  );

  return {
    connectionTracker,
    heartbeatService,
  };
}
