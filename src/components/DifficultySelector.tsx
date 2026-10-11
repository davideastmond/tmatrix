"use client";

import type { Difficulty } from "@/lib/tmatrix-ai";
import React from "react";

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

interface DifficultySelectorProps {
  value: Difficulty;
  onChange: (difficulty: Difficulty) => void;
  /** Small caps label shown before the buttons. */
  label?: string;
  disabled?: boolean;
}

export const DifficultySelector: React.FC<DifficultySelectorProps> = ({
  value,
  onChange,
  label = "CPU difficulty",
  disabled = false,
}) => {
  return (
    <div className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
      <span className="text-[11px] uppercase tracking-wider text-slate-400 px-2">
        {label}
      </span>
      {DIFFICULTIES.map((d) => (
        <button
          key={d}
          type="button"
          disabled={disabled}
          onClick={() => onChange(d)}
          className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors cursor-pointer disabled:cursor-default disabled:opacity-60 ${
            value === d
              ? "bg-emerald-500 text-slate-950"
              : "text-slate-300 hover:bg-slate-700"
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  );
};
