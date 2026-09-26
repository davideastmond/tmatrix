import { connectToDatabase } from "@/db/db";
import { createInitialGameState } from "@/lib";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(req: NextRequest, res: NextResponse) {
  const requestBody = (await req.json()) as { username: string };
  const { username } = requestBody;
  if (!username) {
    return NextResponse.json(
      { error: "Username is required" },
      { status: 400 },
    );
  }

  const { db } = await connectToDatabase();
  const roomUuid = uuidv4();
  const hostPlayerId = uuidv4();
  const initialBoard = createInitialGameState();

  const newRoom = {
    id: roomUuid,
    status: "waiting",
    player1Id: hostPlayerId,
    player1Name: username,
    player2Id: null,
    player2Name: null,
    boardState: initialBoard,
    turn: "player1",
    createdAt: new Date(),
  };

  await db.collection("rooms").insertOne(newRoom);

  if (!JWT_SECRET) {
    return NextResponse.json(
      { error: "JWT secret is not defined" },
      { status: 500 },
    );
  }

  const token = jwt.sign(
    { playerId: hostPlayerId, roomRole: "player1", roomId: roomUuid },
    JWT_SECRET,
    { expiresIn: "24h" },
  );

  return NextResponse.json(
    {
      message: "Room hosted successfully",
      roomId: roomUuid,
      role: "player1",
    },
    {
      status: 200,
      headers: {
        "Set-Cookie": `game_auth=${token}; Path=/; HttpOnly; SameSite=Strict; Secure`,
      },
    },
  );
}
