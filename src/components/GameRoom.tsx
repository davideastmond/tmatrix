import { useEffect, useState } from "react";

import { GameBoard } from "@/components/GameBoard"; // Reuse your clean modular board component
import { GetRoomByIdAPIResponse } from "@/types/api";
import type { RoomData } from "@/types/room";
import { useParams, useRouter } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;
export const GameRoom = () => {
  const params = useParams<{ roomId: string }>();

  const router = useRouter();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${BASE_URL}/join/${params?.roomId}`;

  // 📡 POLLING LOOP: Pings database every 2 seconds ONLY while waiting for player 2
  useEffect(() => {
    if (!params?.roomId) return;

    const checkLobbyStatus = async () => {
      try {
        const response: Response = await fetch(`/api/rooms/${params?.roomId}`);
        if (!response.ok) {
          // if (response.status === 404) navigate("/");
          // return;
        }
        const data = (await response.json()) as GetRoomByIdAPIResponse;
        setRoom(data.room);

        // Optimization: If a player joined and the game is active, turn off the lobby loop
        if (data.status === "playing" || data.status === "ended") {
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Lobby status sync error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    // checkLobbyStatus();
    const interval = setInterval(checkLobbyStatus, 2000);

    return () => clearInterval(interval);
  }, [params?.roomId, router]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
        <p className="mt-4 text-sm text-slate-400">
          Synchronizing Session Hub...
        </p>
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      {/* ────────────────────────── LOBBY WAITING SCREEN ────────────────────────── */}
      {room.status === "waiting" && (
        <div className="w-full max-w-xl bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl text-center">
          <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold tracking-wider uppercase">
            Match Lobby
          </span>
          <h2 className="text-2xl font-bold mt-4 text-slate-100">
            Waiting for Opponent...
          </h2>
          <p className="text-sm text-slate-400 mt-2 mb-6">
            Send this link to a friend to begin your 12x12 duel.
          </p>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center gap-3 mb-4">
            <div className="w-full text-left truncate font-mono text-xs text-slate-400 select-all px-3 py-2.5 bg-slate-900/50 rounded border border-slate-800">
              {inviteUrl}
            </div>
            <button
              onClick={handleCopyLink}
              className={`w-full md:w-auto px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                copied
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              }`}
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Your Identity:{" "}
            <span className="text-blue-400 font-semibold">
              Host ({room.player1Name})
            </span>
          </p>
        </div>
      )}

      {/* ────────────────────────── ACTIVE GAMEPLAY SCREEN ────────────────────────── */}
      {/* Once the database shifts to playing, swap out the loader and boot your core layout */}
      {room.status !== "waiting" && <GameBoard />}
    </div>
  );
};
