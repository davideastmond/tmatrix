# Tactical Arena

Tactical Arena (a.k.a PieceCapture/12x12) is a strategy board game built with Next.js. Players compete on a 12x12 grid, placing pieces to capture enemy units and outscore their opponent before the board fills.

## Project Overview

This project includes:

- Local player versus CPU mode
- Online room-based multiplayer support
- Score tracking and turn management
- A capture-based win system
- A lightweight, browser-based game board

## Game Rules

### Board and setup

- The game board is a 12x12 grid.
- The board starts empty.
- Players alternate turns placing one piece on an empty cell.
- Turns move in a strict sequence: one player places a piece, then the other player does the same.

### Capturing pieces

- A piece can only capture an opponent piece by surrounding it from the orthogonal directions: up, down, left, and right.
- If every neighboring cell around an opponent piece is occupied by the current player and not already marked as captured, that opponent piece is captured.
- Captured pieces remain on the board but are marked as captured and no longer help form future encirclements.

### Self-trap penalty

- If a newly placed piece is immediately trapped on all of its orthogonal sides by enemy pieces, it is marked as captured.
- When this happens, the opposing player receives 1 point as a penalty for the self-trap.
- This creates a tactical risk: aggressive moves can score captures, but poorly placed pieces can also hand points to the opponent.

### Scoring

- Each opponent piece captured by a move awards 1 point to the active player.
- A self-trap penalty awards 1 point to the opponent.
- The match continues until the board is full.

### Winning the game

- When the board is completely filled, the game ends.
- The player with the higher score wins.
- If both players finish with the same score, the result is a draw.

## How the AI Thinks

The CPU opponent (`src/lib/tmatrix-ai.ts`) doesn't just react to the board — it thinks ahead, the way a chess player does: *"if I play here, they'll probably play there, then I can play here..."*

Here's what happens on every CPU turn, in plain language:

**It plays out future moves.** The AI explores sequences of moves several turns deep, scoring each resulting position. It assumes you'll play your best replies, so the move it finally picks is the one with the best *guaranteed* outcome — not just the one that looks good right now. This is what lets it set traps and see through yours, which a move-by-move greedy player can never do.

**It thinks on a clock.** The AI starts by thinking one move ahead, then two, then three, and so on until its time budget runs out (about 0.8 seconds per move by default). Because it works in layers, it always has an answer ready — if time runs out mid-thought, it simply plays the best move from the last fully completed layer.

**It ignores hopeless paths.** While exploring, the AI tracks the best outcome found so far. The moment a line of play proves it can't beat that, the AI stops exploring it and moves on. This pruning is what makes thinking several moves ahead feasible on a 12×12 board.

**It never stops mid-capture.** Cutting off thought at a fixed depth can be misleading — stopping right before an obvious capture lands makes a bad position look fine. So when the AI reaches its depth limit in the middle of a tactical exchange, it keeps thinking (captures only) until the dust settles.

**It remembers positions.** Different move orders often lead to the same board. The AI caches every position it has fully analyzed, so it never pays for the same thinking twice — and it tries the most promising moves first.

**It judges positions like this, in order of importance:**

1. **Score.** Captured pieces decide the game, so the AI cares about the score difference above everything else.
2. **Pieces about to be captured.** A piece with only one empty neighbor is one move away from being surrounded. The AI treats these as urgent — saving its own, hunting yours.
3. **Breathing room.** Every empty space next to a piece is a "liberty." More liberties means harder to surround, so the AI prefers moves that give its pieces room and squeeze yours.
4. **Central control.** Pieces near the center have more neighbors, which makes them naturally harder to trap than pieces on edges and corners.

**Tuning it.** The main knob is thinking time: `getBestMove(board, cpuId, { timeLimitMs: 800 })`. More time means deeper thought and stronger play; less time means a faster, weaker opponent — handy for difficulty levels.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Stack

- Next.js
- React
- TypeScript
- MongoDB for room and game state persistence
- Tailwind CSS

## Notes

This project is designed as a browser-based tactical board game with both local and online play. The core game logic is implemented in the game engine, while the UI and API routes handle turn validation, room flow, and scoring updates.
