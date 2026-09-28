"use client";

import type { GetRoomByIdAPIResponse } from "@/types/api";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
export default function JoinRoom() {
  // Unwrap params using React.use() if your Next.js configuration mandates it,
  // or read it directly depending on your router layout version
  const params = useParams<{ roomId: string }>();
  const roomId = params?.roomId;

  const router = useRouter();

  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [roomDetails, setRoomDetails] = useState<{ hostName: string } | null>(
    null,
  );

  // 1. OPTIONAL LOBBY PREVIEW: Fetch basic info so the player knows whose game they are joining
  useEffect(() => {
    if (!roomId) return;

    const fetchLobbyPreview = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}`);
        if (response.ok) {
          const data = (await response.json()) as GetRoomByIdAPIResponse;
          setRoomDetails({ hostName: data.room.player1Name });
        }
      } catch (err) {
        console.error("Failed to pre-fetch room configurations:", err);
      }
    };

    fetchLobbyPreview();
  }, [roomId]);

  // 2. SUBMIT HANDLER: Execute database join sequence
  const handleJoinGame = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username.trim() || !roomId) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/rooms/join", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          roomId: roomId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to enter game lobby.");
      }

      // Clean redirect over to the active board screen layout
      router.push(`/room/${roomId}`);
    } catch (err: any) {
      setErrorMessage(
        err.message || "An unexpected server connection error occurred.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Basic structural sanitation pattern
    const sanitized = e.target.value.replace(/[^a-zA-Z0-9 ]/g, "");
    setUsername(sanitized);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
        <header className="text-center mb-8">
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold tracking-wider uppercase">
            Invitation Received
          </span>
          <h1 className="text-2xl font-bold mt-4 text-slate-100">
            Join the Matrix
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {roomDetails ? (
              <>
                You have been challenged to a match by{" "}
                <span className="text-blue-400 font-bold">
                  {roomDetails.hostName}
                </span>
                .
              </>
            ) : (
              "Enter your handle alias to connect to your friend."
            )}
          </p>
        </header>

        <form onSubmit={handleJoinGame} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Your Username / Handle
            </label>
            <input
              type="text"
              value={username}
              onChange={handleInputChange}
              placeholder="e.g., ChallengerZero"
              maxLength={20}
              required
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors text-white font-medium placeholder-slate-600"
            />
          </div>

          {errorMessage && (
            <p className="text-sm font-semibold text-rose-400 text-center bg-rose-500/10 py-2 rounded-lg border border-rose-500/20">
              ⚠️ {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-lg transition-colors cursor-pointer"
          >
            {isLoading ? "Connecting to Room..." : "⚔️ Enter Match"}
          </button>
        </form>
      </div>
    </div>
  );
}
