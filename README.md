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

## CPU / AI Logic (WIP)

The CPU opponent evaluates every available empty cell before playing. It does not make a random move; instead, it scores each candidate move by simulating the resulting board state.

The AI prioritizes moves that:

- capture multiple opponent pieces immediately
- set up obvious traps that leave the human player with self-trapping follow-up moves
- keep the CPU piece safe from being trapped on the next turn
- block the human player from making a strong capture
- improve positional control around edges and center spaces
- create pressure on active enemy pieces that can be captured later

The evaluation is driven by the logic in the AI engine, which:

- simulates a placement with the same capture rules as the main game
- checks whether the move would cause a self-trap penalty
- rewards safe captures and punishes dangerous ones
- favors strategic placement near strong board areas
- chooses the highest-scoring valid move, with a random tiebreaker when multiple moves are equally strong

This means the CPU behaves as a tactical scoring engine rather than a simple greedy player, balancing offense, defense, and board control.

I'm still tweaking the algorithm to improve the CPU's decision-making and overall challenge.

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
