# Production Mobile-First Web Game Platform Architecture

## Executive Summary
This document defines the architecture for a mobile-first web game platform hosting board games (e.g., Tic-Tac-Toe, Chess, Checkers, Connect Four) and graphical arcade games (e.g., Brick Blast, Archery, Platformer, Endless Runner).

---

## 1. High-Level Architecture

The platform uses a **Plugin/Cartridge Pattern** separating the host platform from individual game engines.

```
+-------------------------------------------------------------------+
|                        Next.js Platform Shell                     |
|  - App Router (/games/[gameId])                                   |
|  - Viewport Management (100dvh, Touch lock, Fullscreen)           |
|  - Game Registry & Lazy Dynamic Loader                            |
|  - Global Audio & Persistence Service                             |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                   Game Engine Abstraction Layer                   |
|  - GameManifest (metadata, orientation, modes)                    |
|  - IGameController (pause, resume, restart, destroy)              |
|  - ITransport (Local loopback vs future WebSocket)                |
+-------------------------------------------------------------------+
                  /                                   \
                 /                                     \
                v                                       v
+-------------------------------+       +-------------------------------+
|     Board Game Runtime        |       |     Arcade Game Runtime       |
|  - Pure State Reducer         |       |  - Isolated Phaser Canvas     |
|  - React / SVG Presentation   |       |  - 60 FPS Fixed Game Loop     |
|  - Web Worker AI (Minimax)    |       |  - Virtual Mobile Touch D-Pad |
+-------------------------------+       +-------------------------------+
```

---

## 2. Directory Structure

```text
omniPlay/
├── apps/
│   ├── web/                           # Next.js Frontend (Vercel)
│   │   ├── public/                    # Audio files, icons, static assets
│   │   ├── src/
│   │   │   ├── app/                   # Next.js App Router
│   │   │   ├── platform/              # Audio, storage, registry
│   │   │   ├── components/            # UI components (catalog, host, shell)
│   │   │   └── games/                 # Game cartridges (board, arcade)
│   │   └── tests/                     # Frontend unit tests
│   │
│   └── server/                        # Multiplayer Realtime Server (Render)
│       ├── src/
│       │   ├── http/                  # Health check & HTTP routes
│       │   ├── websocket/             # Fastify WebSocket gateway & protocol
│       │   ├── rooms/                 # RoomManager, Room model, reconnect logic
│       │   ├── auth/                  # Cryptographic identity & session management
│       │   ├── security/              # Origin verification & Token Bucket rate limiting
│       │   ├── validation/            # Zod runtime message schemas
│       │   └── games/                 # GameAdapter pluggable abstraction
│       └── tests/                     # Backend unit & integration tests
│
├── docs/                              # Architecture documentation
├── AGENTS.md
├── package.json                       # npm workspace root
└── package-lock.json
```

---

## 3. Separation of Concerns

### Platform Responsibilities
- Routing, navigation, SEO, PWA caching.
- Mounting the active game inside a responsive container.
- Providing platform services (sound on/off, save state, HUD overlay).
- Handling top-level viewport orientation and resize events.

### Game Cartridge Responsibilities
- Implementing `manifest.ts` declaring metadata, modes, and loader.
- Managing its own internal game rules and rendering.
- Exposing the `IGameController` interface (`pause()`, `resume()`, `restart()`, `destroy()`).
- Emitting standard events (`onGameOver`, `onScoreUpdate`).

---

## 4. Game-Engine Abstraction

### Board Games (`engine: 'react-dom'`)
- State changes only on player turns.
- Renders via React/SVG.
- Highly accessible, low battery usage, crisp on all resolutions.

### Arcade Games (`engine: 'phaser'`)
- Continuous 60 FPS update loop.
- Renders via WebGL/Canvas.
- Encapsulated in a React adapter that mounts the canvas once and handles cleanup via `game.destroy(true)` on unmount.
- **Crucial Rule**: React state must never be updated inside the 60 FPS Phaser update loop.

---

## 5. Pure Logic State Machines (Board Games)

Every board game uses a functional reducer:
`reducer(state, action) => nextState`

- Zero DOM or React imports in the `logic/` directory.
- Completely deterministic and testable.
- Shared directly with Web Workers (AI) and future WebSocket game servers.

---

## 6. Bot Architecture (Web Workers)

- Algorithmic evaluations (e.g. Minimax with alpha-beta pruning) are executed inside browser **Web Workers**.
- Worker communication is asynchronous via `postMessage`.
- Main UI thread never stutters, and mobile touch events remain responsive.
- Includes timeout safeguards to ensure bots always reply within acceptable limits.

---

## 7. Transport-Agnostic Networking & Realtime Backend

Game actions pass through `ITransport`:
```typescript
export interface ITransport {
  send(action: GameAction): void;
  onReceive(callback: (action: GameAction) => void): () => void;
  disconnect(): void;
}
```
- **Local 2-Player**: uses `LocalTransport` (direct in-memory dispatch).
- **Online Multiplayer (apps/server)**: uses `WebSocketTransport` connecting to `/ws`:
  - **Authoritative Backend**: Game actions are validated server-side by `GameAdapter` before state transitions.
  - **Envelope Protocol**: Versioned JSON envelopes (`version: 1`, `type`, `requestId`, `payload`).
  - **Room Infrastructure**: Human-friendly 6-character room codes (`ABC234`), 2-player capacity initially, monotonic version increments.
  - **Resilient Reconnection**: 30-second disconnect grace period with cryptographically secure reconnect tokens.
  - **Security & Limits**: Strict Origin allowlist, Token Bucket rate limiting, 32KB payload cap, and zero trust for client claims.

---

## 8. Mobile-First Input Strategy

- `touch-action: none` applied to canvas and game board to eliminate mobile browser gestures (pull-to-refresh, double-tap zoom).
- Dynamic viewport height `100dvh` prevents mobile address bar jumping.
- Minimum 48x48px hit areas for board games with two-step tap verification (tap piece, tap target).
- Floating virtual D-Pad / touch zone overlays for arcade games.

---

## 9. Performance & Resource Management

- **Dynamic Bundling**: Phaser and individual game modules are dynamically imported (`next/dynamic` with `ssr: false`). Landing page remains lightweight.
- **VRAM Cleanup**: Explicit `game.destroy(true)` call on component unmount ensures textures and audio buffers are garbage-collected.
- **Pixel Ratio Clamping**: Canvas resolution is clamped to `min(window.devicePixelRatio, 2.0)` to preserve GPU fill-rate and battery on high-DPI phones.

---

## 10. Security & Anti-Cheat Foundation

- Client-side checks are for user feedback only; in online mode, all moves will be validated on the server via the identical pure reducer.
- Content Security Policy (CSP) restricts unauthorized scripts and limits worker scopes.

---

## 11. Testing Matrix

1. **Logic Tests (Unit)**: 100% test coverage of game state transitions and win evaluations via Vitest/Jest.
2. **AI Verification**: Tests confirming bots output valid moves at each difficulty level.
3. **E2E / Touch (Playwright)**: Verifying game flows on simulated mobile viewports.

---

## 12. Security Strategy

1. **Authoritative State Rule**: In local mode, the client runs the reducer. In future online mode, the server executes the exact same reducer and validates all moves before broadcasting.
2. **Content Security Policy (CSP)**:
   - Enforce `worker-src 'self' blob:` to permit Web Workers.
   - Restrict script sources to prevent cross-site scripting (XSS).
3. **Input Validation**: Validate action payloads before dispatching to reducers to prevent malformed states.

---

## 13. Deployment Architecture & PWA

- **Static Platform Shell**: Hosted on edge CDNs (Vercel, Cloudflare Pages) for low latency.
- **PWA Capabilities**: Service worker (via Serwist / Workbox) caching core assets and game bundles for offline access.
- **Future Realtime Tier**: Dedicated lightweight Node.js/Bun WebSocket servers deployed to container services (e.g. Fly.io, Railway) when online multiplayer is activated.

---

## 14. Scaling Considerations

- **Zero-Cost Scaling for AI**: Because bot computation runs on the user's device via Web Workers, server CPU load for AI is zero regardless of player count.
- **Stateless Web Tier**: Next.js catalog, static game bundles, user accounts, and leaderboards are served via CDN and stateless REST/GraphQL APIs, scaling horizontally with near-zero marginal cost.
- **Stateful Multiplayer Segregation**: When online multiplayer is introduced, WebSocket game servers are partitioned by room IDs using a Redis Pub/Sub backplane, keeping the platform web tier decoupled from realtime game traffic.

---

## 15. Potential Architectural Mistakes to Avoid

1. **Coupling Game Rules to React State**:
   - *Risk*: If rules are written inside React components or hooks, they cannot be tested in headless unit tests, cannot be run inside Web Workers for bot search trees, and cannot be reused on a multiplayer server.
   - *Rule*: Game rules must live in pure, zero-dependency reducer functions (`logic/`).

2. **Allowing React State to Drive Phaser 60 FPS Loops**:
   - *Risk*: Updating React state every tick forces React's reconciler to run 60 times a second, creating massive garbage collection spikes, dropping frames, and draining mobile batteries.
   - *Rule*: Phaser manages its own internal loop and rendering. React only mounts the container and listens for milestone events (e.g., game over, score threshold).

3. **Bundling Phaser or All Games in the Main Bundle**:
   - *Risk*: Phaser is ~1MB. If imported in the main bundle, mobile users will wait seconds just to view the game catalog.
   - *Rule*: All game engines and assets must be dynamically imported on demand (`next/dynamic` with `ssr: false`).

4. **Neglecting Mobile Viewport Quirks (`100vh` bug)**:
   - *Risk*: Mobile browsers (iOS Safari, Android Chrome) change the visible height as the address bar shows and hides, causing canvas clipping and annoying vertical page bounces.
   - *Rule*: Use `100dvh` and CSS `touch-action: none` on game containers.

5. **Failing to Completely Destroy Phaser Instances on Unmount**:
   - *Risk*: Navigating between games leaves WebGL contexts, event listeners, and audio buffers in memory. Mobile browsers will crash after 3-5 game switches due to VRAM exhaustion.
   - *Rule*: Always call `game.destroy(true)` inside the component cleanup function.

6. **Premature Multiplayer & Backend Complexity**:
   - *Risk*: Attempting to wire up WebSockets, user auth, and databases before the core local game state machines and UI touch experience are rock solid leads to compounding bugs and constant rewrites.
   - *Rule*: Perfect the local gameplay experience and pure state reducers first; use the `ITransport` abstraction to plug in multiplayer cleanly when ready.
