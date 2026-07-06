"use client";

import React, { useEffect, useRef, useState } from "react";

interface SelectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}

export default function SelectDropdown({ value, onChange, options }: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // 드롭다운 열릴 때 선택된 항목(없으면 첫 번째) 자동 포커스 — SurveyScreen 지역 선택과 동일 패턴
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const selected = listRef.current.querySelector<HTMLElement>("[data-selected='true']");
    const first = listRef.current.querySelector<HTMLElement>("button");
    (selected ?? first)?.focus();
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
        className={`w-full flex items-center justify-between pl-4 pr-4 py-3.5 rounded-2xl text-xs font-bold transition-all text-left focus:outline-none border ${
          isOpen
            ? "border-blue-500 bg-white"
            : "border-slate-200 bg-white hover:border-blue-400"
        } text-slate-700`}
      >
        <span className="truncate">{value}</span>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-blue-500" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div
          ref={listRef}
          onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
          className="absolute top-full left-0 right-0 mt-1.5 max-h-56 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-xl z-20 divide-y divide-slate-50"
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              data-selected={value === opt ? "true" : undefined}
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-3 text-xs font-semibold hover:bg-slate-50 transition-colors focus:bg-blue-50 focus:outline-none ${
                value === opt ? "text-blue-600 font-bold" : "text-slate-700"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
