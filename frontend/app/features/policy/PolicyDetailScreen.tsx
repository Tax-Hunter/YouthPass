"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { useBookmarkStore } from "@/lib/store/bookmarkStore";
import { useFilterStore } from "@/lib/store/filterStore";
import { usePolicyDetail } from "@/lib/api/policy";
import Badge from "@/app/components/ui/Badge";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}


function Section({ title, icon, accent = "blue", children }: {
  title: string;
  icon: React.ReactNode;
  accent?: "blue" | "neutral";
  children: React.ReactNode;
}) {
  const colors = {
    blue: { border: "border-blue-100", bg: "bg-blue-50/60", iconBg: "bg-blue-100 text-blue-500", label: "text-blue-700" },
    neutral: { border: "border-slate-100", bg: "bg-slate-50/60", iconBg: "bg-slate-200 text-slate-500", label: "text-slate-700" },
  }[accent];
  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${colors.iconBg}`}>
          {icon}
        </div>
        <p className={`text-[12px] font-extrabold ${colors.label} tracking-wide`}>{title}</p>
      </div>
      <div className="pl-8">{children}</div>
    </div>
  );
}

export default function PolicyDetailScreen({ onNavigate }: ScreenProps) {
  const { toggle: toggleBookmark, isBookmarked } = useBookmarkStore();
  const { filters } = useFilterStore();
  const searchParams = useSearchParams();
  const policyId = searchParams.get("id");
  const { policy, isLoading, error } = usePolicyDetail(policyId);

  const isFav = policy ? isBookmarked(policy.plcy_no) : false;
  const hasLink = !!policy?.aply_url_addr;
  const isClosed = policy?.dday === "마감";

  const dDayVariant = (): "danger" | "neutral" => {
    if (!policy) return "neutral";
    if (policy.dday === "마감") return "neutral";
    if (policy.dday.startsWith("D-")) {
      const n = parseInt(policy.dday.slice(2), 10);
      return n <= 7 ? "danger" : "neutral";
    }
    return "neutral";
  };

  const formatDate = (d?: string | null) =>
    d ? d.slice(0, 10).replace(/-/g, ".") : null;

  const applyPeriod = (() => {
    if (!policy) return null;
    if (policy.is_always_open) return "상시 모집";
    const s = formatDate(policy.apply_start_date);
    const e = formatDate(policy.apply_end_date);
    if (s && e) return `${s} ~ ${e}`;
    if (e) return `~ ${e}`;
    return null;
  })();

  const userAge = filters.age;
  const ageMatch = (() => {
    if (!policy || userAge == null) return null;
    const min = policy.sprt_trgt_min_age;
    const max = policy.sprt_trgt_max_age;
    if (min == null && max == null) return null;
    const ok = (min == null || userAge >= min) && (max == null || userAge <= max);
    return ok;
  })();

  if (error) {
    return (
      <div className="flex flex-col h-full bg-white items-center justify-center gap-3 px-8">
        <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p className="text-sm font-bold text-slate-400 text-center">정책 정보를 불러올 수 없습니다.</p>
        <button onClick={() => onNavigate?.("list")} className="text-xs text-blue-600 font-semibold underline">
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-white font-sans select-none flex flex-col">

      {/* ── Content (scrollable) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-stable pt-header">

        {/* ── Title block ── */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-end mb-3">
            {isLoading
              ? <div className="h-6 w-12 bg-slate-200 rounded-md animate-pulse" />
              : <Badge variant={dDayVariant()} size="md">{policy?.dday ?? "-"}</Badge>
            }
          </div>

          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-11/12" />
              <div className="h-5 bg-slate-200 rounded w-7/12" />
            </div>
          ) : (
            <h1 className="text-[18px] font-extrabold text-slate-900 leading-snug tracking-tight">
              {policy?.plcy_nm}
            </h1>
          )}
        </div>

        {/* ── Meta row ── */}
        <div className="px-5 py-4 border-b border-slate-100 space-y-3">

          {isLoading ? (
            <div className="flex gap-2 animate-pulse">
              <div className="h-4 w-28 bg-slate-200 rounded" />
              <div className="h-4 w-20 bg-slate-200 rounded" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500 font-semibold">
              {policy?.sprvsn_inst_cd_nm && (
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {policy.sprvsn_inst_cd_nm}
                </span>
              )}
              {policy?.region && (
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {policy.region}
                </span>
              )}
            </div>
          )}

          {!isLoading && applyPeriod && (
            <div className="flex items-center gap-2 text-[12px]">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-semibold text-slate-500">{applyPeriod}</span>
            </div>
          )}

          {!isLoading && policy?.sprt_trgt_min_age != null && (
            <div className="flex items-center gap-2 text-[12px]">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-semibold text-slate-500">
                만 {policy.sprt_trgt_min_age}
                {policy.sprt_trgt_max_age != null ? `~${policy.sprt_trgt_max_age}` : ""}세
              </span>
              {ageMatch === true && (
                <span className="flex items-center gap-0.5 text-emerald-600 font-bold text-[11px]">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  해당
                </span>
              )}
              {ageMatch === false && (
                <span className="flex items-center gap-0.5 text-slate-400 font-bold text-[11px]">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  미해당
                </span>
              )}
            </div>
          )}

          {!isLoading && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <Badge variant="primary" size="md">{policy?.category ?? "기타"}</Badge>
              {policy?.keywords?.map((kw) => (
                <span
                  key={kw}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                    filters.keywords?.includes(kw)
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  #{kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── 지원 대상 + 혜택 내용 ── */}
        <div className="px-5 py-5 space-y-3">
          <Section
            title="지원 대상"
            accent="blue"
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          >
            {isLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-blue-200/60 rounded w-full" />
                <div className="h-3 bg-blue-200/60 rounded w-4/5" />
                <div className="h-3 bg-blue-200/60 rounded w-3/5" />
              </div>
            ) : policy?.plcy_expln_cn ? (
              <p className="text-[13px] text-slate-700 font-medium leading-relaxed whitespace-pre-line">
                {policy.plcy_expln_cn}
              </p>
            ) : (
              <p className="text-[13px] text-slate-400">정보 없음</p>
            )}
          </Section>

          <Section
            title="혜택 내용"
            accent="neutral"
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            {isLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-slate-200/60 rounded w-11/12" />
                <div className="h-3 bg-slate-200/60 rounded w-3/4" />
              </div>
            ) : policy?.plcy_sprt_cn ? (
              <p className="text-[13px] text-slate-700 font-medium leading-relaxed whitespace-pre-line">
                {policy.plcy_sprt_cn}
              </p>
            ) : (
              <p className="text-[13px] text-slate-400">정보 없음</p>
            )}
          </Section>
        </div>
      </div>

      {/* ── Bottom action bar (always pinned to screen bottom) ── */}
      <div className="shrink-0 px-5 pt-4 border-t border-slate-100 bg-white flex items-center gap-3 pb-safe z-10">
        <button
          onClick={() => policy && toggleBookmark(policy.plcy_no)}
          disabled={isLoading || !policy}
          className={`w-14 h-14 shrink-0 rounded-2xl border-2 flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed ${
            isFav
              ? "bg-rose-50 border-rose-200 text-rose-500"
              : "bg-white border-slate-200 text-slate-400 hover:border-rose-200 hover:text-rose-400"
          }`}
        >
          <svg className={`w-6 h-6 ${isFav ? "fill-current" : "fill-none"}`} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        <button
          onClick={() => {
            if (!hasLink || isClosed) return;
            window.open(policy!.aply_url_addr!, "_blank", "noopener,noreferrer");
          }}
          disabled={isLoading || !policy || !hasLink || isClosed}
          title={isClosed ? "마감된 정책입니다" : !hasLink ? "신청 링크가 제공되지 않는 정책입니다" : undefined}
          className={`flex-1 h-14 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
            isClosed || !hasLink
              ? "bg-slate-100 text-slate-400"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25"
          }`}
        >
          {isClosed ? (
            "마감된 정책입니다"
          ) : !hasLink ? (
            "신청 링크 없음"
          ) : (
            <>
              신청하러 가기
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
