"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function Error404Screen({ onNavigate }: ScreenProps) {
  const router = useRouter();
  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-hidden">
      {/* Main Illustration & Error Text */}
      <div className="flex-1 overflow-y-auto scroll-stable flex flex-col items-center justify-center px-screen py-10 text-center min-h-[350px]">
        
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/mascot/error.png"
          alt=""
          draggable={false}
          className="w-44 h-auto object-contain select-none pointer-events-none mb-6"
        />

        {/* Error Info Text */}
        <h2 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">
          페이지를 찾을 수 없습니다
        </h2>
        <p className="text-xs text-slate-400 font-semibold leading-relaxed">
          입력하신 주소가 정확한지<br />
          다시 한번 확인해주세요.
        </p>
      </div>

      {/* Bottom redirection action button */}
      <footer className="px-screen pb-10 shrink-0">
        <button
          onClick={() => onNavigate?.("home")}
          onMouseEnter={() => {
            router.prefetch("/home");
          }}
          className="w-full py-4.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-[14.5px] shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all"
        >
          홈으로 가기
        </button>
      </footer>
    </div>
  );
}
