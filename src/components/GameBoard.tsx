import {
  BOARD_SIZE,
  createInitialGameState,
  getBestCPUMove,
  isBoardFull,
  processTurn,
} from "@/lib";
import type { GameState } from "@/types/game";
import { useEffect, useState } from "react";

export const GameBoard = () => {
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState(),
  );

  const determineWinner = (
    players: GameState["players"],
  ): GameState["winner"] => {
    const p1Score = players.player1.score;
    const p2Score = players.player2.score;

    if (p1Score > p2Score) return "player1";
    if (p2Score > p1Score) return "player2";
    return "draw";
  };

  const commitTurn = (
    currentState: GameState,
    row: number,
    col: number,
    activePlayer: "player1" | "player2",
  ): GameState => {
    if (
      currentState.board[row][col] !== null ||
      currentState.status === "ended"
    ) {
      return currentState;
    }

    const { newBoard, moverPoints, opponentPoints } = processTurn(
      currentState.board,
      row,
      col,
      activePlayer,
    );

    const opponent: "player1" | "player2" =
      activePlayer === "player1" ? "player2" : "player1";
    const currentPlayer = currentState.players[activePlayer];
    const currentOpponent = currentState.players[opponent];
    const updatedPlayers = {
      ...currentState.players,
      [activePlayer]: {
        ...currentPlayer,
        score: currentPlayer.score + moverPoints,
      },
      [opponent]: {
        ...currentOpponent,
        score: currentOpponent.score + opponentPoints,
      },
    };

    const boardFinished = isBoardFull(newBoard);
    let nextStatus: GameState["status"] = currentState.status;
    let finalWinner: GameState["winner"] = currentState.winner;

    if (boardFinished) {
      nextStatus = "ended";
      finalWinner = determineWinner(updatedPlayers);
    }

    const nextTurn = activePlayer === "player1" ? "player2" : "player1";

    return {
      ...currentState,
      board: newBoard,
      turn: nextTurn,
      players: updatedPlayers,
      status: nextStatus,
      winner: finalWinner,
    };
  };

  useEffect(() => {
    if (gameState.status !== "playing" || gameState.turn !== "player2") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setGameState((currentState) => {
        if (
          currentState.status !== "playing" ||
          currentState.turn !== "player2"
        ) {
          return currentState;
        }

        const cpuMove = getBestCPUMove(currentState.board, "player2");

        if (!cpuMove) {
          return {
            ...currentState,
            status: "ended",
            winner: determineWinner(currentState.players),
          };
        }

        return commitTurn(currentState, cpuMove.row, cpuMove.col, "player2");
      });
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [gameState.board, gameState.status, gameState.turn]);

  const handleCellClick = (row: number, col: number) => {
    if (gameState.turn !== "player1") {
      return;
    }

    setGameState((currentState) =>
      commitTurn(currentState, row, col, "player1"),
    );
  };

  const resetGame = () => {
    setGameState(createInitialGameState());
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      {/* Header & Scoreboard */}
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold tracking-wider mb-4 text-emerald-400">
          Tactical Matrix
        </h1>
        <div className="flex gap-8 bg-slate-800 px-6 py-3 rounded-xl border border-slate-700 shadow-lg">
          <div
            className={`flex flex-col items-center ${gameState.turn === "player1" ? "text-blue-400 font-bold scale-105 transition-all" : "opacity-60"}`}
          >
            <span>{gameState.players.player1.name} (Blue)</span>
            <span className="text-2xl">{gameState.players.player1.score}</span>
          </div>
          <div className="w-px bg-slate-700 self-stretch"></div>
          <div
            className={`flex flex-col items-center ${gameState.turn === "player2" ? "text-rose-400 font-bold scale-105 transition-all" : "opacity-60"}`}
          >
            <span>{gameState.players.player2.name} (Red)</span>
            <span className="text-2xl">{gameState.players.player2.score}</span>
          </div>
        </div>
      </header>

      {/* Game Over Modal Banner */}
      {gameState.status === "ended" && (
        <div className="mb-6 px-6 py-3 bg-emerald-500 text-slate-950 font-bold rounded-lg shadow-md animate-bounce">
          {gameState.winner === "draw"
            ? "It's a Draw!"
            : `🎉 ${gameState.players[gameState.winner!].name} Wins!`}
        </div>
      )}

      {/* 12x12 Game Board Grid Wrapper */}
      <div
        className="grid gap-1 p-2 bg-slate-950 rounded-xl shadow-2xl border-4 border-slate-800"
        style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
          width: "min(90vw, 550px)",
          height: "min(90vw, 550px)",
        }}
      >
        {gameState.board.map((row, rowIndex) =>
          row.map((cellValue, colIndex) => {
            const owner =
              cellValue === null || typeof cellValue === "object"
                ? (cellValue?.owner ?? null)
                : cellValue;
            const isCaptured =
              typeof cellValue === "object" &&
              cellValue !== null &&
              cellValue.isCaptured;

            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                onClick={() => handleCellClick(rowIndex, colIndex)}
                disabled={
                  gameState.status === "ended" || gameState.turn === "player2"
                }
                className="relative aspect-square w-full h-full bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded flex items-center justify-center transition-colors shadow-inner group disabled:cursor-not-allowed disabled:opacity-80"
              >
                {/* Coordinate Label Hint for hover state */}
                {cellValue === null && gameState.status === "playing" && (
                  <span className="absolute text-[8px] opacity-0 group-hover:opacity-30 text-slate-400 pointer-events-none">
                    {rowIndex},{colIndex}
                  </span>
                )}

                {/* Visual Piece Tokens */}
                {cellValue !== null && (
                  <div
                    className={`relative w-4/5 h-4/5 rounded-full shadow-md animate-scaleUp border ${
                      isCaptured
                        ? owner === "player1"
                          ? "bg-blue-500/20 border-dashed border-blue-300 opacity-75"
                          : "bg-rose-500/20 border-dashed border-rose-300 opacity-75"
                        : owner === "player1"
                          ? "bg-gradient-to-br from-blue-400 to-blue-600 border border-blue-300"
                          : "bg-gradient-to-br from-rose-400 to-rose-600 border border-rose-300"
                    }`}
                  >
                    {isCaptured && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black tracking-[0.2em] text-slate-100/90">
                        C
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          }),
        )}
      </div>

      {/* Control Buttons */}
      <button
        onClick={resetGame}
        className="mt-6 px-6 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm font-medium transition-colors shadow-md"
      >
        Reset Match
      </button>
    </div>
  );
};
