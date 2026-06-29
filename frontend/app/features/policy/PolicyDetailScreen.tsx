"use client";

import React, { useState, useEffect } from "react";
import { policies } from "@/app/data/policies";
import { useBookmarkStore } from "@/lib/store/bookmarkStore";
import { useHydrated } from "@/lib/useHydrated";
import Badge from "@/app/components/ui/Badge";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function PolicyDetailScreen({ onNavigate }: ScreenProps) {
  const { toggle: toggleBookmark, isBookmarked } = useBookmarkStore();
  const hydrated = useHydrated();
  const [policyId, setPolicyId] = useState("rent-support-2nd");
  const [isApplied, setIsApplied] = useState(false);
  const [viewMode, setViewMode] = useState("data");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const id = searchParams.get("id");
      if (id) setPolicyId(id);
      const view = searchParams.get("view") || "data";
      setViewMode(view);
    }
  }, []);

  // Sync route checks in component wrapper mode
  useEffect(() => {
    const handleLocationChange = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const id = searchParams.get("id");
      if (id) setPolicyId(id);
      const view = searchParams.get("view") || "data";
      setViewMode(view);
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  const policy = policies.find((p) => p.id === policyId) || policies[0];
  const isFav = hydrated && isBookmarked(policy.id);
  const showSkeleton = viewMode === "skeleton";

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-hidden relative">

      {/* Main Details Body */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-[100px] space-y-6 flex flex-col">
        {/* Top Badges */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="md">
              {policy.category}
            </Badge>
            <button
              onClick={() => {
                const nextView = viewMode === "skeleton" ? "data" : "skeleton";
                setViewMode(nextView);
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.set("view", nextView);
                  window.history.pushState({}, "", url.toString());
                }
              }}
              className="px-2.5 py-1 text-[9px] font-bold text-slate-400 border border-slate-200 rounded-full hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-0.5 cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {viewMode === "skeleton" ? "데이터" : "시안"}
            </button>
          </div>
          <Badge variant={policy.dDay.startsWith("D-") ? "danger" : "neutral"} size="md">
            {policy.dDay}
          </Badge>
        </div>

        {/* Title */}
        {showSkeleton ? (
          <div className="space-y-2.5">
            <div className="h-5 bg-slate-200 rounded-md w-11/12 animate-pulse" />
            <div className="h-5 bg-slate-200 rounded-md w-7/12 animate-pulse" />
          </div>
        ) : (
          <h2 className="text-xl font-bold text-slate-900 leading-snug">
            {policy.title}
          </h2>
        )}

        <div className="border-t border-slate-100 my-4" />

        {/* Section 1: 지원 대상 */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-[14.5px] font-bold text-slate-900">
            <svg className="w-4.5 h-4.5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            지원 대상
          </div>
          {showSkeleton ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-slate-200 rounded-md w-full" />
              <div className="h-4 bg-slate-200 rounded-md w-3/4" />
            </div>
          ) : (
            <p className="text-xs.5 text-slate-600 font-semibold leading-relaxed whitespace-pre-line">
              {policy.target}
            </p>
          )}
        </div>

        {/* Section 2: 혜택 내용 */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-1.5 text-[14.5px] font-bold text-slate-900">
            <svg className="w-4.5 h-4.5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            혜택 내용
          </div>
          {showSkeleton ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-slate-200 rounded-md w-11/12" />
            </div>
          ) : (
            <p className="text-xs.5 text-slate-600 font-semibold leading-relaxed whitespace-pre-line">
              {policy.benefits}
            </p>
          )}
        </div>

        {/* Spacer to push buttons to the bottom while guaranteeing a minimum gap */}
        <div className="flex-1" style={{ minHeight: "48px" }} />

        {/* Divider and bottom action container */}
        <div className="border-t border-slate-100 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={() => toggleBookmark(policy.id)}
              className={`w-14 h-14 shrink-0 rounded-full border flex items-center justify-center transition-all duration-200 active:scale-90 ${
                isFav
                  ? "bg-rose-50 border-rose-100 text-rose-500 shadow-md shadow-rose-100"
                  : "bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200"
              }`}
            >
              <svg className={`w-6 h-6 ${isFav ? "fill-current" : "fill-none"}`} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>

            <button
              onClick={() => {
                setIsApplied(true);
                setTimeout(() => setIsApplied(false), 2000);
                if (typeof window !== "undefined" && policy.link) {
                  window.open(policy.link, "_blank", "noopener,noreferrer");
                }
              }}
              className={`flex-1 py-4 px-5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                isApplied
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25"
              }`}
            >
              {isApplied ? (
                <>
                  신청 완료!
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </>
              ) : (
                <>
                  신청하러 가기
                  <svg className="w-4 h-4 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
