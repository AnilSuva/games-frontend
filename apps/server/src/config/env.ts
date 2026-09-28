import {
  DISCONNECT_GRACE_PERIOD_MS,
  HEARTBEAT_INTERVAL_MS,
  RATE_LIMIT_CAPACITY,
  RATE_LIMIT_REFILL_PER_SEC,
} from "./constants.js";

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: "development" | "production" | "test";
  allowedOrigins: string[];
  logLevel: string;
  heartbeatIntervalMs: number;
  disconnectGracePeriodMs: number;
  rateLimitCapacity: number;
  rateLimitRefillPerSec: number;
}

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://games.anilsuva.com",
];

function parseOrigins(rawOrigins?: string): string[] {
  if (!rawOrigins || rawOrigins.trim() === "") {
    return DEFAULT_ALLOWED_ORIGINS;
  }
  const origins = rawOrigins
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  // Guarantee production frontend origin is always allowed
  if (!origins.some((o) => o.toLowerCase() === "https://games.anilsuva.com")) {
    origins.push("https://games.anilsuva.com");
  }
  return origins;
}

export function loadConfig(): ServerConfig {
  const nodeEnv = (process.env.NODE_ENV ?? "development") as "development" | "production" | "test";
  const port = parseInt(process.env.PORT ?? "3001", 10);
  const host = process.env.HOST ?? "0.0.0.0";
  const allowedOrigins = parseOrigins(process.env.WEB_ALLOWED_ORIGINS);
  const logLevel = process.env.LOG_LEVEL ?? (nodeEnv === "test" ? "silent" : "info");

  const heartbeatIntervalMs = process.env.HEARTBEAT_INTERVAL_MS
    ? parseInt(process.env.HEARTBEAT_INTERVAL_MS, 10)
    : HEARTBEAT_INTERVAL_MS;

  const disconnectGracePeriodMs = process.env.DISCONNECT_GRACE_PERIOD_MS
    ? parseInt(process.env.DISCONNECT_GRACE_PERIOD_MS, 10)
    : DISCONNECT_GRACE_PERIOD_MS;

  const rateLimitCapacity = process.env.RATE_LIMIT_CAPACITY
    ? parseInt(process.env.RATE_LIMIT_CAPACITY, 10)
    : RATE_LIMIT_CAPACITY;

  const rateLimitRefillPerSec = process.env.RATE_LIMIT_REFILL_PER_SEC
    ? parseInt(process.env.RATE_LIMIT_REFILL_PER_SEC, 10)
    : RATE_LIMIT_REFILL_PER_SEC;

  return {
    port: Number.isNaN(port) ? 3001 : port,
    host,
    nodeEnv,
    allowedOrigins,
    logLevel,
    heartbeatIntervalMs,
    disconnectGracePeriodMs,
    rateLimitCapacity,
    rateLimitRefillPerSec,
  };
}

export const config = loadConfig();
