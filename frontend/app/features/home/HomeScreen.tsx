"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useBookmarkStore } from "@/lib/store/bookmarkStore";
import { useAuthStore } from "@/lib/store/authStore";
import { useUiStore } from "@/lib/store/uiStore";
import { useFilterStore, DEFAULT_FILTERS } from "@/lib/store/filterStore";
import { usePolicyList, sortPoliciesByDeadline } from "@/lib/api/policy";
import PolicyCard from "@/app/components/ui/PolicyCard";
import PromoBanner from "@/app/components/ui/PromoBanner";
import SurveyScreen from "@/app/features/auth/SurveyScreen";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function HomeScreen({ onNavigate }: ScreenProps) {
  const router = useRouter();
  const { toggle: toggleBookmark, isBookmarked } = useBookmarkStore();
  const { user } = useAuthStore();
  const { openLoginModal } = useUiStore();
  const { saveFilters } = useFilterStore();
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);

  const openSurvey = () => {
    if (!user) {
      openLoginModal();
      return;
    }
    setIsSurveyOpen(true);
  };

  const { data, error, isLoading } = usePolicyList({ sort: "deadline", size: 4, applicable: true });
  const sortedItems = data?.items ? sortPoliciesByDeadline(data.items) : [];

  const handleCardClick = (plcy_no: string) => {
    onNavigate?.(`detail?id=${plcy_no}`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 font-sans select-none relative overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto pt-header scroll-stable">
      {/* Blue Hero Banner */}
      <div className="bg-blue-600 text-white px-screen pt-9 pb-8 flex flex-col items-start gap-4 shrink-0 shadow-inner relative overflow-hidden">
        <div className="absolute -top-12.5 -right-12.5 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-7.5 -left-5 w-28 h-28 bg-blue-500 rounded-full blur-xl" />

        <div className="relative z-10 space-y-2">
          <h2 className="text-[22px] font-bold leading-tight">
            내게 꼭 맞는 청년 정책,
            <br />
            1분 만에 찾아보세요
          </h2>
          <p className="text-xs text-blue-100/90 leading-relaxed font-medium">
            나이, 거주지, 관심 분야만 입력하면
            <br />
            지금 바로 신청 가능한 지원금을 추천해드려요.
          </p>
        </div>

        <button
          onClick={openSurvey}
          className="relative z-10 px-5 py-2.5 bg-white text-blue-600 hover:bg-blue-50 text-[13px] font-bold rounded-xl shadow-md transition-all active:scale-[0.98]"
        >
          맞춤 정책 찾기
        </button>
      </div>

      {/* Category Grid Section */}
      <section className="px-screen py-6 bg-white shrink-0 grid grid-cols-4 gap-3 border-b border-slate-100">
        {[
          { label: "주거", icon: "home", color: "bg-blue-50 text-blue-600" },
          { label: "금융", icon: "cash", color: "bg-teal-50 text-teal-600" },
          { label: "일자리", icon: "briefcase", color: "bg-indigo-50 text-indigo-600" },
          { label: "교육", icon: "academic", color: "bg-amber-50 text-amber-600" },
        ].map((cat) => (
          <button
            key={cat.label}
            onClick={() => {
              saveFilters({
                ...DEFAULT_FILTERS,
                categories: { ...DEFAULT_FILTERS.categories, [cat.label]: true },
              });
              onNavigate?.("search");
            }}
            onMouseEnter={() => router.prefetch("/search")}
            className="flex flex-col items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition-colors active:scale-95"
          >
            <div className={`w-12 h-12 rounded-2xl ${cat.color} flex items-center justify-center`}>
              {cat.icon === "home" && (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              )}
              {cat.icon === "cash" && (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              )}
              {cat.icon === "briefcase" && (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )}
              {cat.icon === "academic" && (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              )}
            </div>
            <span className="text-xs font-semibold text-slate-600">{cat.label}</span>
          </button>
        ))}
      </section>

      {/* Policy List Section */}
      <section className="px-screen py-6 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">마감 임박 정책</h3>
          <button
            onClick={() => onNavigate?.("search")}
            onMouseEnter={() => router.prefetch("/search")}
            className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
          >
            전체보기
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 bg-white border border-slate-100 rounded-2xl animate-pulse">
                <div className="flex justify-between mb-3">
                  <div className="h-5 w-14 bg-slate-200 rounded-full" />
                  <div className="h-5 w-10 bg-slate-200 rounded-full" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-slate-200 rounded-md w-11/12" />
                  <div className="h-3 bg-slate-200 rounded-md w-7/12" />
                </div>
              </div>
            ))
          ) : error ? (
            <div className="p-5 bg-white border border-slate-100 rounded-2xl text-center text-sm text-slate-500">
              정책을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
            </div>
          ) : (
            sortedItems.map((policy) => (
              <PolicyCard
                key={policy.plcy_no}
                policy={policy}
                isBookmarked={isBookmarked(policy.plcy_no)}
                onToggleBookmark={() => toggleBookmark(policy.plcy_no)}
                onClick={() => handleCardClick(policy.plcy_no)}
                showCategory={true}
                showLocation={true}
                showActionText={false}
                showDday={true}
                showSummary={true}
              />
            ))
          )}
        </div>

        <PromoBanner
          className="mt-6"
          title={
            <span className="text-[9px] font-bold text-blue-600 tracking-wider">
              오늘의 정책 알림
            </span>
          }
          subtitle={
            <h5 className="text-[12.5px] font-bold text-slate-800 leading-tight">
              이미 24,102명의 청년들이
              <br />
              자신의 혜택을 챙겼어요
            </h5>
          }
          rightElement={
            <div className="flex -space-x-2.5 overflow-hidden">
              {[
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&q=80",
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80",
              ].map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  className="inline-block h-7 w-7 rounded-full ring-2 ring-white object-cover"
                  src={url}
                  alt=""
                />
              ))}
              <div className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-100 text-blue-600 ring-2 ring-white text-[9px] font-bold font-mono">
                +24k
              </div>
            </div>
          }
        />
      </section>
      </div>{/* /scroll wrapper */}

      {isSurveyOpen && (
        <div className="absolute inset-0 z-50 bg-white">
          <SurveyScreen onNavigate={(screenId) => {
            setIsSurveyOpen(false);
            if (screenId === "search") onNavigate?.("search");
          }} />
        </div>
      )}
    </div>
  );
}
