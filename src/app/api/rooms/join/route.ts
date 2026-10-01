import { connectToDatabase } from "@/db/db"; // Replace with your exact Mongo db client path
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const JWT_SECRET =
  process.env.JWT_SECRET || "fallback-local-development-secret-key";

export async function PATCH(request: NextRequest) {
  try {
    // 1. Parse incoming JSON request body payload parameters
    const body = await request.json();
    const { username, roomId } = body;

    if (!username || !roomId) {
      return NextResponse.json(
        { error: "Username and Room ID are required parameters." },
        { status: 400 },
      );
    }

    // 2. Establish connection and find the targeted match room
    const { db } = await connectToDatabase();
    const roomsCollection = db.collection("rooms");
    const room = await roomsCollection.findOne({ id: roomId });

    if (!room) {
      return NextResponse.json(
        { error: "Targeted strategy game match room not found." },
        { status: 404 },
      );
    }

    // 3. Validation: Verify that the room layout is still open to accept an opponent
    if (room.status !== "waiting" || room.player2Id !== null) {
      return NextResponse.json(
        { error: "Lobby selection is already locked, full, or active." },
        { status: 400 },
      );
    }

    const joinerPlayerId = uuidv4();

    // 4. Upgrade the database document properties
    await roomsCollection.updateOne(
      { id: roomId },
      {
        $set: {
          player2Id: joinerPlayerId,
          player2Name: username,
          status: "playing", // Switch lobby straight to live gameplay grid context
        },
      },
    );

    // 5. Mint the secure, anonymous JWT identification payload for Player 2
    const token = jwt.sign(
      { playerId: joinerPlayerId, roomRole: "player2", roomId: roomId },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    // 6. Leverage Next.js native header handling to bake the session token cookie
    const cookieStore = await cookies();
    cookieStore.set({
      name: "game_auth",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // Matches the 24 hour JWT expiration
    });

    return NextResponse.json(
      {
        message: "Successfully registered and joined game match room.",
        roomId: roomId,
        role: "player2",
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("API Error inside /rooms/join route handler:", error);
    return NextResponse.json(
      { error: "Internal system processing error handling join sequence." },
      { status: 500 },
    );
  }
}
