export type PlayerId = "player1" | "player2";

export interface Player {
  id: PlayerId;
  name: string;
  score: number;
}
// New Object Structure for cells

export interface GamePiece {
  owner: PlayerId;
  isCaptured: boolean;
}

export type CellValue = PlayerId | GamePiece | null; // null represents an empty space

export interface Coordinate {
  row: number;
  col: number;
}

export interface GameState {
  board: CellValue[][]; // 12x12 grid array
  turn: PlayerId;
  players: Record<PlayerId, Player>;
  status: "playing" | "ended";
  winner: PlayerId | "draw" | null;
}
