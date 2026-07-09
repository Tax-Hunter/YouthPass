"use client";

import React from "react";

interface OptionButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  showCheckmark?: boolean;
  className?: string;
}

export default function OptionButton({
  label,
  isActive,
  onClick,
  showCheckmark = false,
  className = "py-3 px-3",
}: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 shrink-0 ${className} ${
        isActive
          ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/15"
          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
      }`}
    >
      {isActive && showCheckmark && (
        <svg className="w-3.5 h-3.5 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {label}
    </button>
  );
}
