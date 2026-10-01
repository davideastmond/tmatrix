import type { PlayerId } from "./game";

export interface RoomCreateResponse {
  message: string;
  roomId: string;
  role: PlayerId;
}
