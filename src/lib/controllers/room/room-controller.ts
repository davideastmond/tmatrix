import { connectToDatabase } from "@/db/db";
import { RoomData } from "@/types/room";
export async function getRoomById(roomId: string): Promise<RoomData | null> {
  const { db } = await connectToDatabase();

  const room = await db.collection("rooms").findOne({
    id: roomId,
  });
  return room as RoomData | null;
}
