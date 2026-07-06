"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function LoginScreen({ onNavigate }: ScreenProps) {
  const router = useRouter();
  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-header flex flex-col items-center justify-center px-screen py-8">
        {/* Google Login Actions at the top */}
        <div className="w-full flex flex-col items-center gap-3 mb-10">
          <span className="text-xs text-slate-400 font-medium">안전하고 간편하게 로그인하세요</span>
          <button
            onClick={() => {
              window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/get/google-login?redirect_origin=${encodeURIComponent(window.location.origin)}`;
            }}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            {/* Custom Google "G" icon path */}
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.513 0-6.38-2.87-6.38-6.38A6.378 6.378 0 0 1 14 5.75c1.459 0 2.64.5 3.559 1.341l3.181-3.18C18.822 2.1 15.64 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c5.899 0 10.985-4.103 10.985-11.24 0-.693-.06-1.342-.186-1.955H12.24z" />
            </svg>
            Google 계정으로 시작하기
          </button>
        </div>

        {/* Menu Navigation items */}
        <div className="w-full space-y-3">
          {[
            { id: "", label: "홈", icon: "home" },
            { id: "search", label: "정책 목록", icon: "list" },
            { id: "mypage", label: "마이페이지", icon: "user" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate?.(item.id)}
              onMouseEnter={() => {
                router.prefetch(item.id ? `/${item.id}` : "/");
              }}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-100 rounded-2xl transition-all duration-200 group active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100/70 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-250">
                  {item.icon === "home" && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  )}
                  {item.icon === "list" && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  )}
                  {item.icon === "user" && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <span className="font-semibold text-slate-800 text-[15px]">{item.label}</span>
              </div>
              <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
