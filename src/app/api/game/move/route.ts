import { connectToDatabase } from "@/db/db";
import { isBoardFull } from "@/lib/board-utils";
import { processTurn } from "@/lib/game-engine";
import type { JWTPayload } from "@/types/auth";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET =
  process.env.JWT_SECRET || "fallback-local-development-secret-key";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user via the secure HttpOnly cookie
    const cookieStore = await cookies();
    const authCookie = cookieStore.get("game_auth");

    if (!authCookie || !authCookie.value) {
      return NextResponse.json(
        { error: "Unauthorized: Missing active game session." },
        { status: 401 },
      );
    }

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(authCookie.value, JWT_SECRET) as JWTPayload;
    } catch (err) {
      return NextResponse.json(
        { error: "Unauthorized: Session token is invalid or expired." },
        { status: 401 },
      );
    }

    // 2. Parse and validate the placement payload
    const body = await request.json();
    const { roomId, row, col } = body;

    if (!roomId || row === undefined || col === undefined) {
      return NextResponse.json(
        { error: "Missing required parameters: roomId, row, or col." },
        { status: 400 },
      );
    }

    // Security Guard: Prevent a player from submitting moves to a room they don't belong to
    if (decoded.roomId !== roomId) {
      return NextResponse.json(
        {
          error:
            "Forbidden: You are not authorized to make moves in this room.",
        },
        { status: 403 },
      );
    }

    // 3. Retrieve the current room state from MongoDB using your custom 'id' field
    const { db } = await connectToDatabase();
    const roomsCollection = db.collection("rooms");
    const room = await roomsCollection.findOne({ id: roomId });

    if (!room) {
      return NextResponse.json(
        { error: "Game room not found." },
        { status: 404 },
      );
    }

    // 4. Game Rules Guard: Ensure the game is active and it's this player's turn
    if (room.status !== "playing") {
      return NextResponse.json(
        { error: "Game has either not started yet or has already ended." },
        { status: 400 },
      );
    }

    if (room.turn !== decoded.roomRole) {
      return NextResponse.json(
        { error: "It is not your turn to play." },
        { status: 400 },
      );
    }

    if (room.boardState.board[row][col] !== null) {
      return NextResponse.json(
        { error: "Target grid space is already occupied." },
        { status: 400 },
      );
    }

    // 5. Authoritative Rules Evaluation
    // Destructure the updated TurnResult properties: newBoard, moverPoints, opponentPoints
    const { newBoard, moverPoints, opponentPoints } = processTurn(
      room.boardState.board,
      row,
      col,
      decoded.roomRole,
    );

    // Initialize/Fallback scores safely
    let p1ScoreUpdate = room.player1Score || 0;
    let p2ScoreUpdate = room.player2Score || 0;

    // Distribute points dynamically depending on who the active mover is
    if (decoded.roomRole === "player1") {
      p1ScoreUpdate += moverPoints; // Host gets points for active captures
      p2ScoreUpdate += opponentPoints; // Invitee gets points if Host played into a self-capture trap
    } else {
      p2ScoreUpdate += moverPoints; // Invitee gets points for active captures
      p1ScoreUpdate += opponentPoints; // Host gets points if Invitee played into a self-capture trap
    }

    // Evaluate game termination conditions
    const boardFinished = isBoardFull(newBoard);
    let updatedStatus = "playing";
    let finalWinner = null;

    if (boardFinished) {
      updatedStatus = "ended";
      if (p1ScoreUpdate > p2ScoreUpdate) finalWinner = "player1";
      else if (p2ScoreUpdate > p1ScoreUpdate) finalWinner = "player2";
      else finalWinner = "draw";
    }

    // Advance the turn to the opposing player
    const nextTurn = decoded.roomRole === "player1" ? "player2" : "player1";

    // 6. Push the new game state atomically to MongoDB Atlas
    await roomsCollection.updateOne(
      { id: roomId },
      {
        $set: {
          boardState: { board: newBoard },
          turn: nextTurn,
          status: updatedStatus,
          winner: finalWinner,
          player1Score: p1ScoreUpdate,
          player2Score: p2ScoreUpdate,
          lastMoveAt: new Date(),
        },
      },
    );

    return NextResponse.json(
      {
        message: "Move processed successfully.",
        turnAdvancedTo: nextTurn,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("API Error inside /game/move route handler:", error);
    return NextResponse.json(
      { error: "Internal system processing failure logging player turn." },
      { status: 500 },
    );
  }
}
