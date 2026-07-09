"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PolicyCardData, prefetchPolicyDetail } from "@/lib/api/policy";
import Badge from "./Badge";

interface PolicyCardProps {
  policy: PolicyCardData;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onClick: () => void;
  showCategory?: boolean;
  showLocation?: boolean;
  showActionText?: boolean;
  showDday?: boolean;
  showSummary?: boolean;
  showBookmark?: boolean;
}

export default function PolicyCard({
  policy,
  isBookmarked,
  onToggleBookmark,
  onClick,
  showCategory = true,
  showLocation = true,
  showActionText = false,
  showDday = true,
  showSummary = true,
  showBookmark = true,
}: PolicyCardProps) {
  const isDdayClosed = policy.dday === "마감";
  const isDdayUrgent = policy.dday.startsWith("D-");
  const queryClient = useQueryClient();

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => prefetchPolicyDetail(queryClient, policy.plcy_no)}
      className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group relative flex flex-col justify-between"
    >
      <div>
        {/* Top Row: Badge and Bookmark */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {showCategory && (
              <Badge variant="primary" size="sm">
                {policy.category ?? "기타"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showDday && (
              <Badge variant={isDdayClosed ? "neutral" : isDdayUrgent ? "danger" : "primary"} size="sm">
                {policy.dday}
              </Badge>
            )}
            {showBookmark && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark();
                }}
                className={`p-1.5 rounded-full border transition-colors ${
                  isBookmarked
                    ? "bg-rose-50 border-rose-100 text-rose-500"
                    : "bg-slate-50 border-slate-100 text-slate-400 hover:text-rose-500"
                }`}
              >
                <svg className={`w-4 h-4 ${isBookmarked ? "fill-current" : "fill-none"}`} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="font-bold text-[14.5px] text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
          {policy.plcy_nm}
        </h4>

        {/* Description */}
        {showSummary && policy.summary && (
          <p className="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed line-clamp-2">
            {policy.summary}
          </p>
        )}
      </div>

      {/* Footer */}
      {(showLocation || showActionText) && (
        <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-50">
          {showLocation ? (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {policy.region}
            </div>
          ) : (
            <div />
          )}

          {showActionText && (
            <span className="text-[10px] font-bold text-blue-600 group-hover:underline flex items-center gap-0.5">
              상세보기
              <svg className="w-3.5 h-3.5 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
