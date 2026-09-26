import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

// Placeholder API route for fetching room data based on roomId
export async function GET(request: NextRequest, context: RouteContext) {
  const { roomId } = await context.params;
  // Fetch room data from your database or any other source
  const roomData = {
    roomId,
    status: "waiting",
    player1Name: "Alice",
    player2Name: null,
  };
  return NextResponse.json({ ok: true, room: roomData });
}
