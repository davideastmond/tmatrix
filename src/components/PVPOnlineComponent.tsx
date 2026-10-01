"use client";

import { GameBoard } from "@/components/GameBoard"; // Update path to your clean agnostic board
import type { RoomData } from "@/types/room";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function PVPOnlineComponent() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();

  // Core Room State Context
  const [room, setRoom] = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use a ref to keep track of the active interval across components
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. LONG-POLLING ENGINE: Sync state variables with MongoDB Atlas
  useEffect(() => {
    if (!params?.roomId) return;

    const syncMatchState = async () => {
      try {
        const response = await fetch(`/api/rooms/${params.roomId}`);

        if (!response.ok) {
          if (response.status === 404 || response.status === 401) {
            router.push("/"); // Bounce back if room deleted or unauthorized
            return;
          }
          throw new Error("Sync tracking dropped.");
        }

        const data: RoomData = await response.json();
        setRoom(data);
        setIsLoading(false);

        // Optimization: If the match ends completely, kill the background execution loops
        if (data.status === "ended" && pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      } catch (err) {
        console.error("Lobby pooling synchronization failure:", err);
      }
    };

    // Run first network sweep immediately
    syncMatchState();

    // Fire continuous background checks every 1.5 seconds
    pollIntervalRef.current = setInterval(syncMatchState, 1500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [params?.roomId, router]);

  // 2. TRANSMIT PLAYER ACTIONS TO ROUTE HANDLER
  const handleGridInteraction = async (row: number, col: number) => {
    if (!room || room.status !== "playing" || isSubmitting) return;

    // Security verification check: Is it this specific tab's turn to place?
    if (room.turn !== room.yourRole) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/game/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: params?.roomId, row, col }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Turn execution rejected.");
      }

      // Optimistic locally forced state override to provide instant responsiveness
      const updatedTurn = room.yourRole === "player1" ? "player2" : "player1";
      setRoom((prev) => (prev ? { ...prev, turn: updatedTurn } : null));
    } catch (err: any) {
      alert(err.message || "Connection pipeline error processing move.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/join/${params?.roomId}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard injection error:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
        <p className="mt-4 text-sm text-slate-400 font-mono tracking-wider animate-pulse">
          CONNECTING TO ENGINE...
        </p>
      </div>
    );
  }

  if (!room) return null;

  const isMyTurn = room.status === "playing" && room.turn === room.yourRole;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      {/* ────────────────────────── MATCH LOBBY VIEW ────────────────────────── */}
      {room.status === "waiting" && (
        <div className="w-full max-w-xl bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl text-center">
          <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold tracking-wider uppercase">
            Lobby Active
          </span>
          <h2 className="text-2xl font-bold mt-4 text-slate-100">
            Waiting for Opponent...
          </h2>
          <p className="text-sm text-slate-400 mt-2 mb-6">
            Send this link to a challenger to begin your 12x12 tactical duel.
          </p>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center gap-3 mb-4">
            <div className="w-full text-left truncate font-mono text-xs text-slate-400 select-all px-3 py-2.5 bg-slate-900/50 rounded border border-slate-800">
              {`${window.location.origin}/join/${params?.roomId}`}
            </div>
            <button
              onClick={handleCopyLink}
              className={`w-full md:w-auto px-5 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                copied
                  ? "bg-emerald-500 text-slate-950 font-extrabold"
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              }`}
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Your Identity:{" "}
            <span className="text-blue-400 font-semibold">
              {room.player1Name}
            </span>
          </p>
        </div>
      )}

      {/* ────────────────────────── ACTIVE GAMEPLAY DUEL VIEW ────────────────────────── */}
      {room.status !== "waiting" && (
        <div className="flex flex-col items-center animate-scaleUp">
          {/* Unified Dynamic Scoreboard HUD */}
          <header className="text-center mb-6">
            <div className="flex gap-8 bg-slate-800 px-8 py-3 rounded-xl border border-slate-700 shadow-lg items-center mb-4">
              <div
                className={`flex flex-col items-center transition-all ${room.turn === "player1" ? "text-blue-400 font-bold scale-105" : "opacity-40"}`}
              >
                <span className="text-xs uppercase tracking-wider font-semibold">
                  {room.player1Name} {room.yourRole === "player1" && "(You)"}
                </span>
                <span className="text-3xl font-extrabold mt-0.5">
                  {room.player1Score || 0}
                </span>
              </div>
              <div className="text-slate-600 font-bold text-xs bg-slate-950 px-2 py-1 rounded select-none">
                VS
              </div>
              <div
                className={`flex flex-col items-center transition-all ${room.turn === "player2" ? "text-rose-400 font-bold scale-105" : "opacity-40"}`}
              >
                <span className="text-xs uppercase tracking-wider font-semibold">
                  {room.player2Name} {room.yourRole === "player2" && "(You)"}
                </span>
                <span className="text-3xl font-extrabold mt-0.5">
                  {room.player2Score || 0}
                </span>
              </div>
            </div>

            {/* Turn Tracker Notifications */}
            <div className="text-sm font-semibold tracking-wide">
              {room.status === "ended" ? (
                <div className="px-6 py-2 bg-emerald-500 text-slate-950 font-black rounded-lg shadow uppercase">
                  {room.winner === "draw"
                    ? "Match Draw!"
                    : `${room.winner === "player1" ? room.player1Name : room.player2Name} Wins!`}
                </div>
              ) : isMyTurn ? (
                <span className="text-emerald-400 animate-pulse bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full text-xs font-bold uppercase">
                  Your Move! Choose an empty space.
                </span>
              ) : (
                <span className="text-slate-400 bg-slate-950/40 border border-slate-800 px-4 py-1.5 rounded-full text-xs font-medium">
                  Waiting for opponent to place...
                </span>
              )}
            </div>
          </header>

          {/* Core Agnostic UI View Grid Injection */}
          {room.boardState && (
            <GameBoard
              board={room.boardState.board}
              disabled={!isMyTurn || isSubmitting}
              onCellClick={handleGridInteraction}
            />
          )}
        </div>
      )}
    </div>
  );
}
