import type { GameState, PlayerId } from "./game";

export interface RoomCreateResponse {
  message: string;
  roomId: string;
  role: PlayerId;
}

export interface RoomData {
  id: string;
  status: "playing" | "ended" | "waiting";
  player1Id: string;
  player1Name: string;
  player2Id: string | null;
  player2Name: string | null;
  turn: PlayerId;
  createdAt: Date;
  boardState: GameState;
}
