# OmniPlay

A quiet, beautifully crafted collection of browser games. Board classics and arcade physics — zero ads, zero distractions.

> **Status:** v0.1.0 · Tic-Tac-Toe is live · More games coming soon

---

## ✨ Features

- **Clean, minimal design** — warm off-white palette, premium tactile UI, no visual noise
- **Mobile-first** — designed and tested on physical Android phones (360px → tablet → desktop)
- **Instant play** — no accounts, no sign-ups, just pick a game and play
- **Tic-Tac-Toe** — fully playable with 1v1 local and Bot modes (Easy / Medium / Hard AI)
- **Smart bot AI** — Minimax with alpha-beta pruning, three distinct difficulty levels
- **Accessible** — keyboard navigation, screen reader live regions, focus management
- **SEO-friendly** — static generation, proper meta tags, semantic HTML
- **Lightweight** — minimal client JavaScript, code-split game cartridges

## 🎮 Available Games

| Game | Status | Modes |
|------|--------|-------|
| Tic-Tac-Toe | ✅ Playable | 1v1 Local, vs Bot (Easy/Medium/Hard) |
| Connect Four | 🔜 Coming Soon | — |
| Checkers | 🔜 Coming Soon | — |
| Chess | 🔜 Coming Soon | — |
| Brick Blast | 🔜 Coming Soon | — |
| Archery | 🔜 Coming Soon | — |

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| UI | React 19 |
| Fonts | Geist Sans + Geist Mono |
| Testing | Node.js native test runner |

## 📁 Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Home / game catalog
│   └── games/[gameId]/           # Dynamic game pages
│
├── components/
│   ├── catalog/                  # Dashboard, game cards, grid
│   ├── game-host/                # GameContainer, GameHUD, GameHost, PauseModal
│   ├── game-ui/                  # Shared: DifficultySlider, GameModeSelector, GameResultPopup
│   └── shell/                    # Header, Footer
│
├── games/
│   ├── common/                   # Shared game types & interfaces
│   ├── board/
│   │   └── tic-tac-toe/
│   │       ├── bot/              # AI: minimax, difficulty tiers, async service
│   │       ├── logic/            # Pure reducer, rules, types (zero React deps)
│   │       ├── components/       # TicTacToeGame, Cell, WinningStrike
│   │       └── preview/          # Catalog preview card
│   └── arcade/
│       └── brick-blast/          # Placeholder preview
│
├── platform/
│   ├── registry/                 # Game manifests, cartridge map, types
│   ├── audio/                    # Audio service types (future)
│   └── storage/                  # Storage service types (future)
│
tests/
└── tic-tac-toe.test.mjs          # 24 unit tests (reducer, rules, bot, difficulty)
```

## 🏗 Architecture

**Game cartridge model** — each game is an isolated module that plugs into the platform shell:

```
Platform Shell (layout, nav, HUD)
  └── GameContainer (lifecycle, pause, fullscreen)
        └── GameHost (lazy loading, Suspense)
              └── Game Cartridge (self-contained game logic + UI)
```

**Pure game logic** — game state is managed by a deterministic reducer with no React, DOM, or browser dependencies. This makes the logic testable, portable, and future-proof for Web Workers or server-side validation.

**Shared game UI** — reusable components (mode selector, difficulty slider, result popup) are generic and data-driven, ready for any future game to use without duplication.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
# Clone the repo
git clone https://github.com/<your-username>/games.git
cd games

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing on a phone (LAN)

```bash
npm run dev -- --hostname 0.0.0.0
```

Then open `http://<your-local-ip>:3000` on your phone.

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run all unit tests (24 tests) |

## 🧪 Testing

```bash
npm test
```

Runs 24 unit tests covering:
- Game state initialization
- Move validation (valid, occupied, out-of-bounds, post-game)
- All 8 win conditions (3 rows, 3 columns, 2 diagonals)
- Draw detection
- State reset
- Bot move legality
- Bot win/block detection
- Minimax optimality (two hard bots always draw)
- Difficulty tier behavior (easy randomness, medium balance, hard perfection)

## 📋 Roadmap

- [ ] Connect Four
- [ ] Checkers
- [ ] Chess (with Web Worker AI)
- [ ] Brick Blast (Phaser)
- [ ] Archery
- [ ] Online multiplayer (WebSockets)
- [ ] User profiles & leaderboards
- [ ] PWA / offline support

## 📄 License

This project is private. All rights reserved.
