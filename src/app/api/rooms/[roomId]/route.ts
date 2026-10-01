import { connectToDatabase } from "@/db/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET =
  process.env.JWT_SECRET || "fallback-local-development-secret-key";

interface JWTPayload {
  playerId: string;
  roomRole: "player1" | "player2";
  roomId: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }, // Awaitable params structure in modern Next.js
) {
  try {
    // 1. Resolve dynamic path route id parameter string
    const { roomId } = await context.params;

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID parameter is missing." },
        { status: 400 },
      );
    }

    // 2. Extract and parse the secure session cookie header
    const cookieStore = await cookies();
    const authCookie = cookieStore.get("game_auth");

    if (!authCookie || !authCookie.value) {
      return NextResponse.json(
        { error: "Unauthorized: Missing active game token session." },
        { status: 401 },
      );
    }

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(authCookie.value, JWT_SECRET) as JWTPayload;
    } catch (err) {
      return NextResponse.json(
        { error: "Unauthorized: Session identity expired or invalid." },
        { status: 401 },
      );
    }

    // Security Guard: Prevent players from snooping on match rooms they aren't part of
    if (decoded.roomId !== roomId) {
      return NextResponse.json(
        { error: "Forbidden: You do not have tracking access to this match." },
        { status: 403 },
      );
    }

    // 3. Connect and query the room from MongoDB using your custom string 'id' field
    const { db } = await connectToDatabase();
    const room = await db.collection("rooms").findOne({ id: roomId });

    if (!room) {
      return NextResponse.json(
        { error: "Game lobby not found." },
        { status: 404 },
      );
    }

    // 4. Return the complete authenticated state payload
    // 🟢 The "yourRole" property is now dynamically appended straight out of their verified JWT claim
    return NextResponse.json(
      {
        roomId: room.id,
        status: room.status,
        player1Name: room.player1Name,
        player2Name: room.player2Name,
        boardState: room.boardState,
        turn: room.turn,
        player1Score: room.player1Score || 0,
        player2Score: room.player2Score || 0,
        winner: room.winner,
        yourRole: decoded.roomRole, // 🟢 Here is your calculation fix!
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error inside dynamic room route handler:", error);
    return NextResponse.json(
      { error: "Internal system processing error fetching room states." },
      { status: 500 },
    );
  }
}
