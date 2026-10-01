import type { CellValue, Coordinate, GameState } from "../types/game";
import { BOARD_SIZE } from "./constants";

export function getNeighbors(row: number, col: number): Coordinate[] {
  const directions = [
    { row: -1, col: 0 }, // Up
    { row: 1, col: 0 }, // Down
    { row: 0, col: -1 }, // Left
    { row: 0, col: 1 }, // Right
  ];

  return directions
    .map((d) => ({ row: row + d.row, col: col + d.col }))
    .filter(
      (n) =>
        n.row >= 0 && n.row < BOARD_SIZE && n.col >= 0 && n.col < BOARD_SIZE,
    );
}

export function isBoardFull(board: CellValue[][]): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

export function createInitialGameState(): GameState {
  return {
    board: Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null)),
    turn: "player1",
    players: {
      player1: { id: "player1", name: "Human", score: 0 },
      player2: { id: "player2", name: "CPU", score: 0 },
    },
    status: "playing",
    winner: null,
  };
}
