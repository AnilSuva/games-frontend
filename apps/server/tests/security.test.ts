import test from "node:test";
import assert from "node:assert/strict";
import { isOriginAllowed } from "../src/security/origin.js";
import { TokenBucketRateLimiter } from "../src/security/rateLimit.js";
import { parseClientMessage } from "../src/validation/messages.js";
import { ConnectionTracker, PlayerConnection } from "../src/websocket/connection.js";
import { HeartbeatService } from "../src/websocket/heartbeat.js";

test("Security: isOriginAllowed permits allowed origins and rejects others", () => {
  const allowed = ["http://localhost:3000", "https://games.anilsuva.com"];

  // Exact matches
  assert.equal(isOriginAllowed("http://localhost:3000", allowed), true);
  assert.equal(isOriginAllowed("https://games.anilsuva.com", allowed), true);

  // Trailing slash normalization
  assert.equal(isOriginAllowed("http://localhost:3000/", allowed), true);
  assert.equal(isOriginAllowed("https://games.anilsuva.com/", allowed), true);

  // Case normalization
  assert.equal(isOriginAllowed("HTTP://LOCALHOST:3000", allowed), true);

  // Disallowed origins
  assert.equal(isOriginAllowed("http://evil-site.com", allowed), false);
  assert.equal(isOriginAllowed("https://games.anilsuva.com.evil.com", allowed), false);
  assert.equal(isOriginAllowed("http://localhost:4000", allowed), false);

  // Missing origin handling
  assert.equal(isOriginAllowed(undefined, allowed, false), false);
  assert.equal(isOriginAllowed(undefined, allowed, true), true);
});

test("Security: TokenBucketRateLimiter respects capacity and refills over time", async () => {
  const limiter = new TokenBucketRateLimiter(5, 10); // 5 capacity, 10/sec refill

  // Consume burst of 5
  for (let i = 0; i < 5; i++) {
    assert.equal(limiter.tryConsume(1), true, `Token ${i + 1} should be permitted`);
  }

  // Next token should fail
  assert.equal(limiter.tryConsume(1), false, "Should reject when capacity exhausted");

  // Wait 150ms -> should refill ~1.5 tokens
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(limiter.tryConsume(1), true, "Should allow token after refill time");
});

test("Security: parseClientMessage rejects messages exceeding size limit", () => {
  // Construct 33KB string payload (limit is 32KB = 32768 bytes)
  const largeData = JSON.stringify({
    version: 1,
    type: "ping",
    requestId: "req_oversized",
    payload: { blob: "X".repeat(33 * 1024) },
  });

  const result = parseClientMessage(largeData);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "MESSAGE_TOO_LARGE");
    assert.ok(result.error.includes("exceeds maximum allowed size"));
  }
});

test("Security: parseClientMessage rejects malformed JSON", () => {
  const invalidJson = "{ this is not json }";
  const result = parseClientMessage(invalidJson);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "MALFORMED_JSON");
  }
});

test("Security: HeartbeatService detects and terminates dead connections", () => {
  const tracker = new ConnectionTracker();
  let terminated = false;
  let pingsSent = 0;

  const mockSocket = {
    readyState: 1,
    ping: () => {
      pingsSent++;
    },
    terminate: () => {
      terminated = true;
    },
    close: () => {},
  } as any;

  const conn = new PlayerConnection(mockSocket);
  tracker.add(conn);
  assert.equal(tracker.size(), 1);

  let deadCleanedId: string | undefined;
  const heartbeat = new HeartbeatService(tracker, 1000, (id) => {
    deadCleanedId = id;
  });

  // Cycle 1: connection isAlive starts true -> heartbeat marks false and sends ping
  heartbeat.checkConnections();
  assert.equal(pingsSent, 1);
  assert.equal(conn.isAlive, false);
  assert.equal(terminated, false);
  assert.equal(tracker.size(), 1);

  // Cycle 2: socket did NOT reply with pong -> connection is still isAlive = false -> terminated!
  heartbeat.checkConnections();
  assert.equal(terminated, true);
  assert.equal(tracker.size(), 0);
  assert.equal(deadCleanedId, conn.connectionId);

  heartbeat.stop();
});
