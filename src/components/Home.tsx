"use client";

import type { RoomCreateResponse } from "@/types/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const Home: React.FC = () => {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim()) return;
    // Send the username to the backend to create a new game session
    // Once we get a successful response, we can redirect the user to the game page
    try {
      setIsLoading(true);
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });
      if (res.ok) {
        // Redirect the user to the game page using react-router
        const data = (await res.json()) as RoomCreateResponse;
        router.push(`/room/${data.roomId}`);
      } else {
        setErrorMessage("Failed to create game. Please try again. [1]");
      }
    } catch (error) {
      setErrorMessage("Failed to create game. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <h1 className="text-3xl font-bold tracking-wider mb-6 text-emerald-400">
        Tactical Matrix
      </h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg w-full max-w-sm"
      >
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-400"
            required
            maxLength={50}
          />
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg px-4 py-2 transition-colors"
        >
          Create game
        </button>
        {errorMessage && (
          <p className="text-red-500 text-sm mt-2">{errorMessage}</p>
        )}
      </form>

      <div className="mt-4 flex gap-6 text-sm">
        <Link
          href="/game"
          className="text-emerald-400 hover:text-emerald-300 underline"
        >
          Play vs CPU
        </Link>
        <Link
          href="/cpu-battle"
          className="text-emerald-400 hover:text-emerald-300 underline"
        >
          Watch CPU vs CPU
        </Link>
      </div>
    </div>
  );
};
