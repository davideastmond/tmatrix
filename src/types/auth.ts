export interface JWTPayload {
  playerId: string;
  roomRole: "player1" | "player2";
  roomId: string;
}
