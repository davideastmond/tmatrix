import type { GameState, GameStatus, PlayerId } from "./game";

export interface RoomData {
  id: string;
  status: GameStatus;
  player1Id: string;
  player1Name: string;
  player2Id: string | null;
  player2Name: string | null;
  turn: PlayerId;
  createdAt: Date;
  boardState: GameState;
}
