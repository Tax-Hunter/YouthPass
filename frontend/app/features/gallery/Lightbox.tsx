"use client";

import { useEffect, useCallback, useState } from "react";
import Image from "next/image";
import { Screen } from "@/app/data/screens";
import InteractiveScreen from "./InteractiveScreen";

interface Props {
  screens: Screen[];
  current: number;
  onClose: () => void;
  onNav: (dir: 1 | -1) => void;
  onSelectIndex?: (index: number) => void;
}

export default function Lightbox({ screens, current, onClose, onNav, onSelectIndex }: Props) {
  const screen = screens[current];
  const [viewMode, setViewMode] = useState<"image" | "interactive">("interactive");

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onNav(-1);
      if (e.key === "ArrowRight") onNav(1);
    },
    [onClose, onNav]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

  const handleNavigate = (screenId: string) => {
    const route = screenId.split("?")[0];
    const targetIdx = screens.findIndex(
      (s) =>
        s.id === route ||
        (route === "detail" && s.id === "policy-detail") ||
        (route === "list" && s.id === "policy-list") ||
        (route === "skeleton" && s.id === "policy-list-v2") ||
        (route === "bookmarks" && s.id === "bookmarks")
    );
    if (targetIdx !== -1 && onSelectIndex) {
      onSelectIndex(targetIdx);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xl"
      onClick={onClose}
    >
      {/* top control bar */}
      <div className="absolute top-4 inset-x-6 flex items-center justify-between pointer-events-none z-20">
        {/* counter */}
        <p className="text-xs text-white/30 font-mono tabular-nums select-none">
          {current + 1} / {screens.length}
        </p>

        {/* mode toggle switch */}
        <div className="flex bg-white/5 border border-white/10 p-0.5 rounded-full pointer-events-auto shadow-md">
          <button
            onClick={() => setViewMode("interactive")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              viewMode === "interactive"
                ? "bg-violet-600 border border-violet-500/30 text-white shadow-[0_2px_10px_rgba(109,92,255,0.35)]"
                : "text-white/45 hover:text-white/75 border border-transparent"
            }`}
          >
            라이브 컴포넌트
          </button>
          <button
            onClick={() => setViewMode("image")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              viewMode === "image"
                ? "bg-violet-600 border border-violet-500/30 text-white shadow-[0_2px_10px_rgba(109,92,255,0.35)]"
                : "text-white/45 hover:text-white/75 border border-transparent"
            }`}
          >
            시안 이미지
          </button>
        </div>

        {/* close */}
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full pointer-events-auto
                     bg-white/8 border border-white/12 text-white/70 text-lg
                     hover:bg-white/15 hover:text-white hover:scale-105 active:scale-95 transition-all"
        >
          ✕
        </button>
      </div>

      <div
        className="flex items-center gap-4 md:gap-7 px-4 mt-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* prev */}
        <button
          onClick={() => onNav(-1)}
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-xl font-bold select-none
                     bg-white/8 border border-white/12 text-white/85 hover:text-white
                     hover:bg-violet-600 hover:border-violet-500 hover:scale-105 active:scale-95 transition-all"
        >
          ‹
        </button>

        {/* phone frame */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative overflow-hidden
                       border-2 border-white/12
                       shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_0_1px_rgba(109,92,255,0.25)]"
            style={{ width: "min(335px, 82vw)", aspectRatio: "9/19.5" }}
          >
            {/* Status bar notch */}
            {viewMode === "image" && (
              <div className="absolute top-0 inset-x-0 z-30 flex justify-center pointer-events-none">
                <div className="w-26 h-5.5 bg-black rounded-b-2xl" />
              </div>
            )}

            {/* Screen Content */}
            <div className="w-full h-full relative z-10 bg-white">
              {viewMode === "interactive" ? (
                <InteractiveScreen screenId={screen.id} onNavigate={handleNavigate} />
              ) : (
                <Image
                  src={screen.file}
                  alt={screen.label}
                  fill
                  sizes="335px"
                  className="object-cover object-top pointer-events-none"
                  priority
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full
                             bg-violet-600/80 text-white shadow-sm">
              {screen.category}
            </span>
            <span className="text-[13px] font-bold text-white/90">{screen.label}</span>
          </div>
        </div>

        {/* next */}
        <button
          onClick={() => onNav(1)}
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-xl font-bold select-none
                     bg-white/8 border border-white/12 text-white/85 hover:text-white
                     hover:bg-violet-600 hover:border-violet-500 hover:scale-105 active:scale-95 transition-all"
        >
          ›
        </button>
      </div>
    </div>
  );
}
