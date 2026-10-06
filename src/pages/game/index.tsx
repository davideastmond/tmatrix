"use client";

import { GameBoard } from "@/components/GameBoard"; // Update with your exact component path
import { useEffect, useState } from "react";

import { createInitialGameState, isBoardFull } from "@/lib/board-utils";
import { processTurn } from "@/lib/game-engine";
import { getBestMove } from "@/lib/tmatrix-ai";
import { GameState } from "@/types/game";
export default function HumanVsCpuGame() {
  // 1. Maintain the local game loop state
  const [gameState, setGameState] = useState<GameState>(
    createInitialGameState(),
  );
  const [isThinking, setIsThinking] = useState(false);
  const [lastCpuMove, setLastCpuMove] = useState<{
    row: number;
    col: number;
  } | null>(null);

  // 2. Automated AI Trigger Loop
  useEffect(() => {
    // Only fire if it's the CPU's turn and the game is active
    if (gameState.turn === "player2" && gameState.status === "playing") {
      // Create an intentional short delay so the CPU feels organic
      const timer = setTimeout(() => {
        setIsThinking(true);

        const cpuMove = getBestMove(gameState.board, "player2");

        if (cpuMove) {
          const { newBoard, moverPoints, opponentPoints } = processTurn(
            gameState.board,
            cpuMove.row,
            cpuMove.col,
            "player2",
          );

          // Apply the active player's captured pieces and any self-capture penalty.
          const updatedPlayers = { ...gameState.players };
          updatedPlayers.player2.score += moverPoints;
          updatedPlayers.player1.score += opponentPoints;

          const boardFinished = isBoardFull(newBoard);
          let newStatus: GameState["status"] = gameState.status;
          let finalWinner: GameState["winner"] = gameState.winner;

          if (boardFinished) {
            newStatus = "ended";
            const p1Score = updatedPlayers.player1.score;
            const p2Score = updatedPlayers.player2.score;
            if (p1Score > p2Score) finalWinner = "player1";
            else if (p2Score > p1Score) finalWinner = "player2";
            else finalWinner = "draw";
          }

          setLastCpuMove({ row: cpuMove.row, col: cpuMove.col });
          setGameState({
            ...gameState,
            board: newBoard,
            turn: "player1", // Return turn to human
            players: updatedPlayers,
            status: newStatus,
            winner: finalWinner,
          });
        }
        setIsThinking(false);
      }, 600); // 600ms tactical calculation buffer

      return () => clearTimeout(timer);
    }
  }, [
    gameState,
    gameState.turn,
    gameState.status,
    gameState.board,
    gameState.players,
    gameState.winner,
  ]);

  // 3. Human Placement Input Handler
  const handleHumanCellClick = (row: number, col: number) => {
    // Blocks move if game is over, or if it is currently the CPU's turn
    if (
      gameState.status === "ended" ||
      gameState.turn !== "player1" ||
      isThinking
    ) {
      return;
    }

    const { newBoard, moverPoints, opponentPoints } = processTurn(
      gameState.board,
      row,
      col,
      "player1",
    );

    const updatedPlayers = { ...gameState.players };
    updatedPlayers.player1.score += moverPoints;
    updatedPlayers.player2.score += opponentPoints;

    const boardFinished = isBoardFull(newBoard);
    let newStatus: GameState["status"] = gameState.status;
    let finalWinner: GameState["winner"] = gameState.winner;

    if (boardFinished) {
      newStatus = "ended";
      const p1Score = updatedPlayers.player1.score;
      const p2Score = updatedPlayers.player2.score;
      if (p1Score > p2Score) finalWinner = "player1";
      else if (p2Score > p1Score) finalWinner = "player2";
      else finalWinner = "draw";
    }

    setGameState({
      ...gameState,
      board: newBoard,
      turn: "player2", // Pass turn over to the AI loop
      players: updatedPlayers,
      status: newStatus,
      winner: finalWinner,
    });
  };

  const handleReset = () => {
    setGameState(createInitialGameState());
    setIsThinking(false);
    setLastCpuMove(null);
  };

  // Determine global UI interaction allowances
  const isBoardDisabled =
    gameState.status === "ended" || gameState.turn === "player2" || isThinking;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      {/* Score Header */}
      <header className="text-center mb-6">
        <h1 className="text-3xl font-extrabold tracking-wider mb-4 text-emerald-400">
          Tactical Arena
        </h1>
        <div className="flex gap-8 bg-slate-800 px-6 py-3 rounded-xl border border-slate-700 shadow-lg items-center">
          <div
            className={`flex flex-col items-center transition-all ${gameState.turn === "player1" ? "text-blue-400 font-bold scale-105" : "opacity-50"}`}
          >
            <span className="text-sm font-medium">
              {gameState.players.player1.name} (Blue)
            </span>
            <span className="text-2xl mt-0.5">
              {gameState.players.player1.score}
            </span>
          </div>
          <div className="w-px bg-slate-700 self-stretch"></div>
          <div
            className={`flex flex-col items-center transition-all ${gameState.turn === "player2" ? "text-rose-400 font-bold scale-105" : "opacity-50"}`}
          >
            <span className="text-sm font-medium">
              {gameState.players.player2.name} (Red)
            </span>
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
                : `🎉 ${gameState.players[gameState.winner!].name} Wins!`}
            </div>
          ) : isThinking ? (
            <span className="text-rose-400 animate-pulse">
              🤖 CPU is calculating strategic positions...
            </span>
          ) : (
            <span className="text-emerald-400">
              🟢 Your Turn! Secure a space.
            </span>
          )}
        </div>
      </header>

      {/* The Pure Agnostic Grid View Component */}
      <GameBoard
        board={gameState.board}
        disabled={isBoardDisabled}
        onCellClick={handleHumanCellClick}
        lastCpuMove={lastCpuMove}
      />

      {/* Action Tray */}
      <button
        onClick={handleReset}
        className="mt-6 px-6 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm font-medium transition-colors shadow-md cursor-pointer"
      >
        Reset Game
      </button>
    </div>
  );
}
