"use client";

import { DifficultySelector } from "@/components/DifficultySelector";
import { GameBoard } from "@/components/GameBoard";
import { useEffect, useState } from "react";

import { createInitialGameState, isBoardFull } from "@/lib/board-utils";
import { processTurn } from "@/lib/game-engine";
import { getBestMove, type Difficulty } from "@/lib/tmatrix-ai";
import type { GameState, PlayerId } from "@/types/game";

/** Pause between moves so the battle is watchable (AI think time adds on top). */
const MOVE_DELAY_MS = 350;
const P1_KEY = "tmatrix:battle-p1";
const P2_KEY = "tmatrix:battle-p2";

function loadDifficulty(key: string): Difficulty {
  if (typeof window === "undefined") return "hard";
  const saved = window.localStorage.getItem(key);
  return saved === "easy" || saved === "medium" || saved === "hard"
    ? saved
    : "hard";
}

function cpuName(id: PlayerId): string {
  return id === "player1" ? "CPU 1" : "CPU 2";
}

export default function CpuVsCpuBattle() {
  const [gameState, setGameState] = useState<GameState>(
    createInitialGameState(),
  );
  const [difficultyP1, setDifficultyP1] = useState<Difficulty>(() =>
    loadDifficulty(P1_KEY),
  );
  const [difficultyP2, setDifficultyP2] = useState<Difficulty>(() =>
    loadDifficulty(P2_KEY),
  );
  const [running, setRunning] = useState(false);
  const [lastMove, setLastMove] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [moveCount, setMoveCount] = useState(0);

  // Derived: the loop is alive and the game is still on, so a CPU is thinking.
  const isThinking = running && gameState.status === "playing";

  useEffect(() => {
    try {
      window.localStorage.setItem(P1_KEY, difficultyP1);
      window.localStorage.setItem(P2_KEY, difficultyP2);
    } catch {
      // Storage unavailable — preferences just won't stick.
    }
  }, [difficultyP1, difficultyP2]);

  // Battle loop: each tick, the side to move thinks and plays.
  useEffect(() => {
    if (!running || gameState.status !== "playing") return;
    const timer = setTimeout(() => {
      const side: PlayerId = gameState.turn;
      const difficulty = side === "player1" ? difficultyP1 : difficultyP2;
      const move = getBestMove(gameState.board, side, { difficulty });

      if (!move) {
        setRunning(false);
        return;
      }

      const { newBoard, moverPoints, opponentPoints } = processTurn(
        gameState.board,
        move.row,
        move.col,
        side,
      );

      const updatedPlayers = { ...gameState.players };
      if (side === "player1") {
        updatedPlayers.player1.score += moverPoints;
        updatedPlayers.player2.score += opponentPoints;
      } else {
        updatedPlayers.player2.score += moverPoints;
        updatedPlayers.player1.score += opponentPoints;
      }

      const boardFinished = isBoardFull(newBoard);
      let newStatus: GameState["status"] = "playing";
      let winner: GameState["winner"] = null;
      if (boardFinished) {
        newStatus = "ended";
        const s1 = updatedPlayers.player1.score;
        const s2 = updatedPlayers.player2.score;
        winner = s1 > s2 ? "player1" : s2 > s1 ? "player2" : "draw";
      }

      setLastMove({ row: move.row, col: move.col });
      setMoveCount((c) => c + 1);
      setGameState({
        ...gameState,
        board: newBoard,
        turn: side === "player1" ? "player2" : "player1",
        players: updatedPlayers,
        status: newStatus,
        winner,
      });
    }, MOVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [running, gameState, difficultyP1, difficultyP2]);

  const handleStart = () => {
    setGameState(createInitialGameState());
    setLastMove(null);
    setMoveCount(0);
    setRunning(true);
  };

  const handleStop = () => {
    setRunning(false);
  };

  const handleReset = () => {
    setRunning(false);
    setGameState(createInitialGameState());
    setLastMove(null);
    setMoveCount(0);
  };

  const thinkingCpu =
    gameState.turn === "player1" ? "CPU 1 (Blue)" : "CPU 2 (Red)";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <header className="text-center mb-6">
        <h1 className="text-3xl font-extrabold tracking-wider mb-4 text-emerald-400">
          CPU vs CPU Battle
        </h1>

        {/* Score Header */}
        <div className="flex gap-8 bg-slate-800 px-6 py-3 rounded-xl border border-slate-700 shadow-lg items-center">
          <div
            className={`flex flex-col items-center transition-all ${gameState.turn === "player1" && running ? "text-blue-400 font-bold scale-105" : "opacity-50"}`}
          >
            <span className="text-sm font-medium">CPU 1 (Blue)</span>
            <span className="text-2xl mt-0.5">
              {gameState.players.player1.score}
            </span>
          </div>
          <div className="flex flex-col items-center text-slate-400">
            <span className="text-[11px] uppercase tracking-wider">Move</span>
            <span className="text-2xl mt-0.5 text-white">{moveCount}</span>
          </div>
          <div className="w-px bg-slate-700 self-stretch"></div>
          <div
            className={`flex flex-col items-center transition-all ${gameState.turn === "player2" && running ? "text-rose-400 font-bold scale-105" : "opacity-50"}`}
          >
            <span className="text-sm font-medium">CPU 2 (Red)</span>
            <span className="text-2xl mt-0.5">
              {gameState.players.player2.score}
            </span>
          </div>
        </div>

        {/* State Banner HUD */}
        <div className="mt-4 text-sm font-semibold tracking-wide">
          {gameState.status === "ended" ? (
            <div className="px-6 py-2 bg-emerald-500 text-slate-950 font-bold rounded-lg shadow animate-bounce">
              {gameState.winner === "draw"
                ? "Match Ended in a Draw!"
                : `🎉 ${cpuName(gameState.winner!)} Wins!`}
            </div>
          ) : isThinking ? (
            <span className="text-rose-400 animate-pulse">
              🤖 {thinkingCpu} is thinking...
            </span>
          ) : running ? (
            <span className="text-emerald-400">⚔️ Battle in progress...</span>
          ) : (
            <span className="text-slate-400">
              Set each CPU&apos;s difficulty, then press Start.
            </span>
          )}
        </div>

        {/* Difficulty selectors */}
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <DifficultySelector
            label="CPU 1 (Blue)"
            value={difficultyP1}
            onChange={setDifficultyP1}
            disabled={running}
          />
          <DifficultySelector
            label="CPU 2 (Red)"
            value={difficultyP2}
            onChange={setDifficultyP2}
            disabled={running}
          />
        </div>
      </header>

      <GameBoard
        board={gameState.board}
        disabled
        onCellClick={() => {}}
        lastCpuMove={lastMove}
      />

      {/* Controls */}
      <div className="mt-6 flex gap-3">
        {!running && gameState.status !== "ended" && (
          <button
            onClick={handleStart}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-sm transition-colors shadow-md cursor-pointer"
          >
            ▶ Start battle
          </button>
        )}
        {running && (
          <button
            onClick={handleStop}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-sm transition-colors shadow-md cursor-pointer"
          >
            ⏸ Stop
          </button>
        )}
        {gameState.status === "ended" && (
          <button
            onClick={handleStart}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-sm transition-colors shadow-md cursor-pointer"
          >
            ↻ Rematch
          </button>
        )}
        <button
          onClick={handleReset}
          className="px-6 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm font-medium transition-colors shadow-md cursor-pointer"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
