import type { GameStatus, PlayerId } from "./game";
import type { RoomData } from "./room";

export interface RoomCreateResponse {
  message: string;
  roomId: string;
  role: PlayerId;
}

export type GetRoomByIdAPIResponse = {
  status: GameStatus;
  room: RoomData;
};
