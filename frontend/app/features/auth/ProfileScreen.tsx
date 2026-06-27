"use client";

import React from "react";
import { useRouter } from "next/navigation";
import PromoBanner from "@/app/components/ui/PromoBanner";
import { useUser } from "@/lib/useUser";
import { useLogout } from "@/lib/useLogout";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function ProfileScreen({ onNavigate }: ScreenProps) {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const { logout, isLoggingOut } = useLogout({
    onSuccess: () => onNavigate?.("login"),
  });

  const displayName = isLoading
    ? null
    : user
    ? (user.nickname ?? user.email) + " 님"
    : "닉네임 님";

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-hidden">
      {/* Sticky Profile Header */}
      <div className="sticky top-0 z-10 px-6 py-6 shrink-0 border-b border-slate-100 bg-white">
        {!isLoading && !user ? (
          /* 비로그인 상태 */
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-400 font-medium text-center">안전하고 간편하게 로그인하세요</p>
            <button
              onClick={() => {
                window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/get/google-login`;
              }}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[13px] font-bold shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.513 0-6.38-2.87-6.38-6.38A6.378 6.378 0 0 1 14 5.75c1.459 0 2.64.5 3.559 1.341l3.181-3.18C18.822 2.1 15.64 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c5.899 0 10.985-4.103 10.985-11.24 0-.693-.06-1.342-.186-1.955H12.24z" />
              </svg>
              Google 계정으로 시작하기
            </button>
          </div>
        ) : (
          /* 로그인 상태 (로딩 중 포함) */
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-teal-600 flex items-center justify-center text-white overflow-hidden shadow-inner border border-teal-500">
                {user?.profile_image ? (
                  <img
                    src={user.profile_image}
                    alt="프로필"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-11 h-11 translate-y-1.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}
              </div>
              <span className="absolute bottom-0.5 right-0.5 block h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className="space-y-1 cursor-pointer group" onClick={() => onNavigate?.("mypage")}>
              <h2 className="text-[17px] font-bold text-slate-900 leading-none flex items-center gap-1.5 group-hover:text-blue-600 transition-colors">
                {isLoading ? (
                  <span className="inline-block w-24 h-4 bg-slate-200 rounded animate-pulse" />
                ) : (
                  displayName
                )}
                <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </h2>
              <p className="text-[10px] text-emerald-500 font-extrabold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 block" />
                로그인됨
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Menu Sections */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 flex flex-col">
        
        {/* Section 1: 메뉴 */}
        <div className="space-y-2.5">
          <h4 className="text-[11px] font-bold text-slate-400 tracking-wide uppercase">메뉴</h4>
          <div className="space-y-1">
            {[
              { id: "", label: "홈", icon: "home", color: "bg-blue-50 text-blue-600" },
              { id: "list", label: "정책 목록", icon: "list", color: "bg-slate-100 text-slate-600" },
              { id: "mypage", label: "마이페이지", icon: "user", color: "bg-slate-100 text-slate-600" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate?.(item.id)}
                onMouseEnter={() => {
                  router.prefetch(item.id ? `/${item.id}` : "/");
                }}
                className="w-full flex items-center justify-between py-3.5 px-2 hover:bg-slate-50 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${item.color} flex items-center justify-center`}>
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
                  <span className="text-[14px] font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {item.label}
                  </span>
                </div>
                <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: 서비스 및 지원 */}
        <div className="space-y-2.5">
          <h4 className="text-[11px] font-bold text-slate-400 tracking-wide uppercase">서비스 및 지원</h4>
          <div className="space-y-1">
            {[
              { id: "support", label: "고객센터", icon: "support" },
              { id: "settings", label: "알림 설정", icon: "settings" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => alert(`${item.label} 메뉴 준비 중입니다.`)}
                className="w-full flex items-center justify-between py-3.5 px-2 hover:bg-slate-50 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                    {item.icon === "support" && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    )}
                    {item.icon === "settings" && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[14px] font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {item.label}
                  </span>
                </div>
                <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Promo banner: 나에게 맞는 정책 찾기 */}
        <PromoBanner
          onClick={() => onNavigate?.("location")}
          onMouseEnter={() => {
            router.prefetch("/location");
          }}
          title={<span className="text-[13px] font-extrabold text-blue-600">나에게 맞는 정책 찾기</span>}
          subtitle={<p className="text-[10px] text-slate-400 font-semibold leading-none">지금 바로 혜택을 찾아보세요</p>}
          rightElement={
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          }
        />

      </div>

      {/* Sticky Bottom: 로그인 상태일 때만 표시 */}
      {(isLoading || user) && (
        <div className="sticky bottom-0 shrink-0 px-6 pt-4 pb-6 flex flex-col items-center gap-3 border-t border-slate-100 bg-white">
          <button
            onClick={logout}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-[13px] font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
          <span className="text-[10px] text-slate-400 font-bold font-mono">Youth Policy Portal v1.2.0</span>
        </div>
      )}
    </div>
  );
}
