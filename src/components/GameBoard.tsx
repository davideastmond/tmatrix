import { BOARD_SIZE } from "@/lib/constants";
import type { CellValue } from "@/types/game";
import React from "react";

interface GameBoardProps {
  board: CellValue[][];
  disabled?: boolean;
  onCellClick: (row: number, col: number) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  board,
  disabled = false,
  onCellClick,
}) => {
  return (
    <div
      className="grid gap-1 p-2 bg-slate-950 rounded-xl shadow-2xl border-4 border-slate-800"
      style={{
        gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        width: "min(90vw, 520px)",
        height: "min(90vw, 520px)",
      }}
    >
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          // 1. Core Logic: Extract structural parameters regardless of type form
          const isOccupied = cell !== null;

          // Type Guarding: Determine if it's an object or a plain string
          const owner = isOccupied
            ? typeof cell === "object"
              ? cell.owner
              : cell
            : null;

          const isCaptured = isOccupied
            ? typeof cell === "object"
              ? cell.isCaptured
              : false
            : false;

          return (
            <button
              key={`${rowIndex}-${colIndex}`}
              onClick={() => onCellClick(rowIndex, colIndex)}
              disabled={disabled || isOccupied}
              className={`relative aspect-square w-full h-full rounded flex items-center justify-center transition-all shadow-inner ${
                !isOccupied && !disabled
                  ? "bg-slate-800 hover:bg-slate-700 cursor-pointer"
                  : "bg-slate-900/60"
              }`}
            >
              {/* Visual Piece Tokens */}
              {isOccupied && owner && (
                <div
                  className={`relative flex items-center justify-center rounded-full shadow-md transition-all duration-300 ${
                    isCaptured
                      ? "w-1/2 h-1/2 opacity-30 saturate-50 scale-90" // Captured adjustments
                      : "w-4/5 h-4/5 animate-scaleUp" // Active piece adjustments
                  } ${
                    owner === "player1"
                      ? "bg-gradient-to-br from-blue-400 to-blue-600 border border-blue-300"
                      : "bg-gradient-to-br from-rose-400 to-rose-600 border border-rose-300"
                  }`}
                >
                  {/* Captured overlay mark */}
                  {isCaptured && (
                    <span className="text-slate-900 font-bold text-xs select-none">
                      ✕
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
};
