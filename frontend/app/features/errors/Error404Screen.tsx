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
        
        {/* Sad emoji magnifying glass graphic container */}
        <div className="relative mb-8 flex items-center justify-center">
          
          {/* Main Sad Smiley Face Circle */}
          <div className="w-32 h-32 rounded-full bg-blue-100/70 border-4 border-blue-50/20 flex flex-col items-center justify-center gap-2 relative">
            <div className="flex gap-4.5 mt-4">
              <div className="w-2.5 h-2.5 rounded-full bg-white" />
              <div className="w-2.5 h-2.5 rounded-full bg-white" />
            </div>
            {/* Sad Mouth SVG */}
            <svg className="w-10 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15a7 7 0 0114 0" />
            </svg>
          </div>

          {/* Overlapping Magnifying Glass card */}
          <div className="absolute bottom-[-10px] right-[5px] w-14 h-14 bg-white rounded-2xl shadow-lg border border-slate-50 flex items-center justify-center z-10 animate-pulse-slow">
            <div className="relative flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {/* Little red/blue X inside glass */}
              <div className="absolute top-[3px] left-[3px] w-3 h-3 bg-blue-600 rounded-full flex items-center justify-center">
                <svg className="w-1.5 h-1.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>
        </div>

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
