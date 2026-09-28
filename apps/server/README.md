# OmniPlay Multiplayer Realtime Server

Authoritative, realtime WebSocket & HTTP server backend for OmniPlay games, designed for deployment on Render.

---

## 📌 Architecture Overview

The OmniPlay backend provides the generic multiplayer foundation for turn-based and realtime browser games. It implements room lifecycle management, cryptographic player identity, connection tracking, rate limiting, origin authorization, and disconnect/reconnect grace periods.

```
Client (Web / Next.js)
       │
       │ WebSocket (/ws) with Origin verification
       ▼
+─────────────────────────────────────────────────────────+
| Fastify HTTP & WebSocket Gateway                        |
|  - GET /health                                          |
|  - Rate limiting (Token Bucket per connection)          |
|  - Strict Origin check & payload limits (32KB)          |
|  - Zod message schema validation                        |
+─────────────────────────────────────────────────────────+
       │
       ▼
+─────────────────────────────────────────────────────────+
| Session & Identity Layer                                |
|  - Cryptographic player IDs (ply_...)                   |
|  - Secure session tokens & reconnect tokens             |
|  - In-memory session store (ISessionStore interface)     |
+─────────────────────────────────────────────────────────+
       │
       ▼
+─────────────────────────────────────────────────────────+
| Room Management Layer (RoomManager)                     |
|  - Unique 6-character room codes (ABC234)               |
|  - Monotonically increasing room state versioning        |
|  - Disconnect grace period & seat reservation           |
|  - GameAdapter abstraction (decoupled game logic)       |
+─────────────────────────────────────────────────────────+
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 22+ (Node.js 24 LTS recommended)
- npm

### Installation

From the monorepo root:

```bash
npm install
```

### Running Locally

```bash
# Start backend in development mode with hot reload
npm run dev:server

# Or run from inside apps/server
cd apps/server
npm run dev
```

The server binds to `0.0.0.0:3001` by default.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev:server` | Start server with `tsx watch` |
| `npm run build:server` | Compile TypeScript into `dist/` |
| `npm run typecheck:server` | Strict TypeScript typecheck |
| `npm run test:server` | Run all 19 automated unit & integration tests |
| `npm start -w server` | Run compiled production build (`node dist/index.js`) |

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` or set these in your hosting environment:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port to bind (set automatically by Render in production) |
| `HOST` | `0.0.0.0` | Host to bind |
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `WEB_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated list of allowed HTTP/WebSocket origins |
| `LOG_LEVEL` | `info` | Pino log level (`trace`, `debug`, `info`, `warn`, `error`, `silent`) |
| `DISCONNECT_GRACE_PERIOD_MS` | `30000` | Reconnect grace window (ms) before player is removed |
| `HEARTBEAT_INTERVAL_MS` | `30000` | Central heartbeat ping interval (ms) |

---

## 📡 Endpoints

### 1. HTTP Health Check
- **Route**: `GET /health`
- **Response**:
  ```json
  {
    "status": "ok",
    "service": "omniplay-server"
  }
  ```

### 2. WebSocket Gateway
- **Route**: `GET /ws` (Upgrade: websocket)
- **URL**: `ws://localhost:3001/ws` (local) or `wss://<render-service-name>.onrender.com/ws` (production)

---

## 📜 WebSocket Protocol (v1)

Every message exchanged across the WebSocket follows a predictable versioned envelope:

```json
{
  "version": 1,
  "type": "<message_type>",
  "requestId": "req_123456",
  "payload": {}
}
```

### Client → Server Messages

| Type | Payload Fields | Purpose |
|---|---|---|
| `session.identify` | `{ sessionToken?: string, displayName?: string }` | Register or restore player session |
| `room.create` | `{ gameId: string, maxPlayers?: number, displayName?: string }` | Create a new multiplayer room |
| `room.join` | `{ roomCode: string, displayName?: string }` | Join room via 6-character code |
| `room.leave` | `{ roomId?: string }` | Explicitly leave active room |
| `room.reconnect` | `{ roomCode: string, reconnectToken: string }` | Reattach to room after temporary disconnect |
| `ping` | `{ clientTime?: number }` | Application-level latency ping |

### Server → Client Messages

| Type | Payload Fields | Purpose |
|---|---|---|
| `session.ready` | `{ playerId: string, sessionToken: string, displayName?: string }` | Confirms session identity |
| `room.created` | `{ room: RoomDto, reconnectToken: string }` | Room created; returns room details and reconnect token |
| `room.joined` | `{ room: RoomDto, reconnectToken: string }` | Player joined; returns room state and reconnect token |
| `room.updated` | `{ room: RoomDto, reason: string }` | Broadcast to all room players on membership/state change |
| `room.left` | `{ roomId: string }` | Confirms player left room |
| `room.error` | `{ code: ErrorCode, message: string }` | Standardized machine-readable error response |
| `server.pong` | `{ serverTime: number, clientTime?: number }` | Pong response echoing client timestamp |

### Error Codes

- `ROOM_NOT_FOUND`: Room code does not exist
- `ROOM_FULL`: Maximum room capacity reached
- `INVALID_MESSAGE`: Malformed message payload or missing fields
- `MALFORMED_JSON`: Non-JSON data sent
- `MESSAGE_TOO_LARGE`: Payload exceeds 32KB
- `INVALID_VERSION`: Envelope version is not 1
- `UNAUTHORIZED`: Action attempted before `session.identify`
- `INVALID_SESSION`: Player not found in session store
- `INVALID_ROOM_STATE`: Cannot join room that has already started or ended
- `RECONNECT_EXPIRED`: Reconnect token is invalid or grace period expired
- `RATE_LIMITED`: Connection sent too many requests in a short window
- `INTERNAL_ERROR`: Unexpected server exception

---

## 🔒 Security Model

1. **Strict Origin Checking**: WebSocket handshake verifies `Origin` header against `WEB_ALLOWED_ORIGINS`. Unauthorized origins are rejected with 403 Forbidden.
2. **Payload Protection**: Maximum 32 KB per message payload; larger messages are rejected immediately.
3. **Per-Connection Rate Limiting**: Token Bucket rate limiter (30 token burst, 20 tokens/sec refill). Excess messages return `RATE_LIMITED`.
4. **No Client-Asserted State**: Client-provided IDs, winning claims, or state assertions are never trusted. All IDs and room codes are generated cryptographically by the server.
5. **No Leaked Secrets**: Sensitive data (session tokens, reconnect tokens) are never printed in server logs.

---

## 🔄 Disconnect & Reconnect Lifecycle

When a client loses network connection:
1. Fastify detects socket closure.
2. The player's status in the room transitions to `connected: false`.
3. An event `room.updated` (`reason: "player_disconnected"`) is broadcast to the remaining player.
4. The server reserves the player's seat for `DISCONNECT_GRACE_PERIOD_MS` (30 seconds).
5. If the player reconnects within the grace period via `room.reconnect` with their `reconnectToken`:
   - Connection is reattached.
   - A fresh `reconnectToken` is issued.
   - `room.updated` (`reason: "player_reconnected"`) is broadcast to the room.
6. If the grace period expires without reconnection:
   - The player is removed from the room.
   - If empty, the room is deleted; otherwise, status transitions to `abandoned`.

---

## ⚠️ Current Architecture & Limitations

- **In-Memory State**: This initial server version stores room state and player sessions in server memory.
- **Single Instance**: Designed for a single Render Web Service instance.
- **Future Horizontal Scaling**: Room and session stores are isolated behind clean interfaces (`ISessionStore`, `RoomManager`). In a future phase, these interfaces can be backed by Redis / Valkey without altering the WebSocket protocol or game adapters.

---

## 🚀 Deploying to Render

1. Create a new **Web Service** on [Render](https://render.com).
2. Connect the OmniPlay GitHub repository.
3. Configure the following settings:
   - **Environment**: `Node`
   - **Root Directory**: `apps/server` (or run from root with `-w server`)
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `WEB_ALLOWED_ORIGINS`: `https://games.anilsuva.com` (your production frontend domain)
   - `LOG_LEVEL`: `info`
5. Render automatically injects `PORT`. The server will bind to `0.0.0.0:$PORT`.
6. Once deployed, the WebSocket URL will be:
   ```text
   wss://<your-service-name>.onrender.com/ws
   ```
