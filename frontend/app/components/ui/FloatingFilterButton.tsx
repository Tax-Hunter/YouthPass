"use client";

import React from "react";

interface FloatingFilterButtonProps {
  onClick: () => void;
  onMouseEnter?: () => void;
  active?: boolean;
}

export default function FloatingFilterButton({ onClick, onMouseEnter, active }: FloatingFilterButtonProps) {
  return (
    <div className="absolute bottom-6 inset-x-0 flex justify-center z-10">
      <button
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className={`relative flex items-center gap-1.5 px-6 py-3 text-white rounded-full text-sm font-bold shadow-lg active:scale-95 transition-all cursor-pointer ${
          active
            ? "bg-blue-600 hover:bg-blue-500 shadow-blue-600/35"
            : "bg-slate-900 hover:bg-slate-800 shadow-slate-900/35"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        필터
      </button>
    </div>
  );
}
