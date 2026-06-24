"use client";

import React from "react";

interface SelectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}

export default function SelectDropdown({ value, onChange, options }: SelectDropdownProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-4 pr-10 py-3.5 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 bg-white appearance-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt}>{opt}</option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
