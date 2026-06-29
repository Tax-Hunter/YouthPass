"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useBookmarkStore } from "@/lib/store/bookmarkStore";
import { useAuthStore } from "@/lib/store/authStore";
import { useFilterStore } from "@/lib/store/filterStore";
import { useLogout } from "@/lib/useLogout";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function MyPageScreen({ onNavigate }: ScreenProps) {
  const router = useRouter();
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const { bookmarks } = useBookmarkStore();
  const { user, isLoading } = useAuthStore();
  const { filters } = useFilterStore();
  const { logout, isLoggingOut } = useLogout({
    onSuccess: () => router.replace("/home"),
  });

  const filterBadges = [
    filters.age != null ? `만 ${filters.age}세` : null,
    filters.city && filters.city !== "전국" ? filters.city : null,
    filters.employment || null,
  ].filter(Boolean) as string[];

  const displayName = isLoading
    ? null
    : user
    ? (user.nickname ?? user.email) + " 님"
    : "닉네임 님";

  const joinedAt = user?.created_at
    ? user.created_at.slice(0, 10)
    : null;

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-112.5 flex flex-col pt-19">
      {/* Main Profile Header */}
      <div className="px-6 py-6 flex items-center gap-4 shrink-0">
        <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 overflow-hidden">
          {user?.profile_image ? (
            <img
              src={user.profile_image}
              alt="프로필"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>
        <div className="space-y-1">
          <h2 className="text-[17px] font-bold text-slate-900 leading-tight">
            {isLoading ? (
              <span className="inline-block w-24 h-4 bg-slate-200 rounded animate-pulse" />
            ) : (
              displayName
            )}
          </h2>
          <p className="text-xs text-slate-400 font-semibold">
            {isLoading ? (
              <span className="inline-block w-32 h-3 bg-slate-200 rounded animate-pulse" />
            ) : joinedAt ? (
              `가입일 ${joinedAt}`
            ) : null}
          </p>
        </div>
      </div>

      {/* Settings Card Blocks */}
      <div className="px-6 py-2 space-y-4 shrink-0">

        {/* Bookmarked Policy Card */}
        <button
          onClick={() => onNavigate?.("bookmarks")}
          onMouseEnter={() => {
            router.prefetch("/bookmarks");
          }}
          className="w-full flex items-center justify-between p-5 bg-white border border-slate-100/70 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.99] group text-left"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-700 fill-none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="text-[14.5px] font-bold text-slate-800">찜한 정책</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[15px] font-extrabold text-blue-600 font-mono">{bookmarks.length}</span>
            <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Notifications Alert Toggle Card */}
        <div className="w-full flex items-center justify-between p-5 bg-white border border-slate-100/70 rounded-2xl shadow-sm transition-all text-left">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-[14.5px] font-bold text-slate-800">마감 임박 알림</span>
          </div>
          <button
            onClick={() => setAlertsEnabled(!alertsEnabled)}
            className={`w-12 h-6.5 rounded-full p-0.5 transition-colors focus:outline-none flex items-center ${
              alertsEnabled ? "bg-blue-600 justify-end" : "bg-slate-200 justify-start"
            }`}
          >
            <span className="w-5.5 h-5.5 rounded-full bg-white shadow-sm" />
          </button>
        </div>
      </div>

      {/* User filter status capsules */}
      <div className="px-6 py-6 flex flex-wrap gap-2 shrink-0 border-b border-slate-50">
        {filterBadges.length > 0 ? (
          filterBadges.map((badge) => (
            <span
              key={badge}
              className="px-3.5 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
            >
              {badge}
            </span>
          ))
        ) : (
          <span className="text-xs text-slate-400 font-semibold">설문을 완료하면 조건이 표시됩니다</span>
        )}
      </div>

      {/* Survey modification action button */}
      <div className="px-6 py-4 shrink-0">
        <button
          onClick={() => onNavigate?.("survey")}
          onMouseEnter={() => {
            router.prefetch("/survey");
          }}
          className="w-full py-3.5 bg-white border border-slate-200 hover:border-blue-500 rounded-xl text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors active:scale-98"
        >
          설문 조건 수정
        </button>
      </div>

      {/* Logout Action button */}
      <div className="px-6 pb-10 pt-4 shrink-0 mt-auto">
        <button
          onClick={logout}
          disabled={isLoggingOut}
          className="w-full py-4 bg-white border border-slate-200 hover:border-rose-500 rounded-2xl text-[13px] font-bold text-slate-500 hover:text-rose-500 transition-colors active:scale-98 text-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
      </div>

      </div>
    </div>
  );
}
