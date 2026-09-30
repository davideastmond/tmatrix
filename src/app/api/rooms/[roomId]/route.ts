import { getRoomById } from "@/lib/controllers/room/room-controller";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

// Placeholder API route for fetching room data based on roomId
export async function GET(request: NextRequest, context: RouteContext) {
  const { roomId } = await context.params;
  // Fetch room data from your database or any other source

  if (!roomId) {
    return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
  }

  try {
    const roomData = await getRoomById(roomId);
    return NextResponse.json({ ...roomData });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch room data" },
      { status: 500 },
    );
  }
}
