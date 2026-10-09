import { connectToDatabase } from "@/db/db";
import type { ChatMessage } from "@/types/chat";
import type { JWTPayload } from "@/types/auth";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET =
  process.env.JWT_SECRET || "fallback-local-development-secret-key";

const MAX_TEXT_LENGTH = 500;
const MAX_HISTORY = 100;

type AuthResult =
  | { decoded: JWTPayload }
  | { error: string; status: number };

/** Same session-cookie auth as the other room routes. */
async function authenticate(roomId: string): Promise<AuthResult> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("game_auth");

  if (!authCookie || !authCookie.value) {
    return { error: "Unauthorized: Missing active game session.", status: 401 };
  }

  let decoded: JWTPayload;
  try {
    decoded = jwt.verify(authCookie.value, JWT_SECRET) as JWTPayload;
  } catch {
    return { error: "Unauthorized: Session token is invalid.", status: 401 };
  }

  if (decoded.roomId !== roomId) {
    return { error: "Forbidden: Not a member of this room.", status: 403 };
  }

  return { decoded };
}

let chatIndexEnsured = false;

async function ensureChatIndex(db: Awaited<ReturnType<typeof connectToDatabase>>["db"]) {
  if (chatIndexEnsured) return;
  await db.collection("chat_messages").createIndex({ roomId: 1, createdAt: 1 });
  // TTL index: auto-delete messages older than 7 days (single-field required by MongoDB).
  await db.collection("chat_messages").createIndex({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
  chatIndexEnsured = true;
}

/**
 * Poll for messages. Supports `?since=<ISO timestamp>` to fetch only new
 * messages; without it, returns the most recent history (up to MAX_HISTORY).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await context.params;
    const auth = await authenticate(roomId);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { db } = await connectToDatabase();
    await ensureChatIndex(db);

    const sinceParam = request.nextUrl.searchParams.get("since");
    const filter: Record<string, unknown> = { roomId };
    if (sinceParam) {
      const since = new Date(sinceParam);
      if (!Number.isNaN(since.getTime())) {
        // $gte + client-side id dedupe: never miss a same-millisecond message.
        filter.createdAt = { $gte: since };
      }
    }

    const docs = await db
      .collection("chat_messages")
      .find(filter)
      .sort({ createdAt: 1 })
      .limit(MAX_HISTORY)
      .toArray();

    const messages: ChatMessage[] = docs.map((d) => ({
      id: String(d.id),
      roomId: String(d.roomId),
      senderRole: d.senderRole,
      senderName: String(d.senderName),
      text: String(d.text),
      createdAt: new Date(d.createdAt).toISOString(),
    }));

    return NextResponse.json({ messages }, { status: 200 });
  } catch (error) {
    console.error("API Error inside /rooms/[roomId]/chat GET:", error);
    return NextResponse.json(
      { error: "Failed to load chat messages." },
      { status: 500 },
    );
  }
}

/** Send a message to the room. Sender identity comes from the JWT. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await context.params;
    const auth = await authenticate(roomId);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => null);
    const rawText = typeof body?.text === "string" ? body.text : "";
    const text = rawText.trim().slice(0, MAX_TEXT_LENGTH);

    if (!text) {
      return NextResponse.json(
        { error: "Message text is required." },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();
    await ensureChatIndex(db);

    const room = await db.collection("rooms").findOne({ id: roomId });
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const senderName =
      auth.decoded.roomRole === "player1"
        ? room.player1Name
        : (room.player2Name ?? "Player 2");

    const message: ChatMessage = {
      id: randomUUID(),
      roomId,
      senderRole: auth.decoded.roomRole,
      senderName: String(senderName ?? "Unknown player"),
      text,
      createdAt: new Date().toISOString(),
    };

    await db.collection("chat_messages").insertOne({
      ...message,
      createdAt: new Date(message.createdAt),
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("API Error inside /rooms/[roomId]/chat POST:", error);
    return NextResponse.json(
      { error: "Failed to send chat message." },
      { status: 500 },
    );
  }
}
