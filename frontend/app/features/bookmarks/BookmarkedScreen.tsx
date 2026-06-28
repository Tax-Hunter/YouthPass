"use client";

import React, { useState } from "react";
import { policies } from "@/app/data/policies";
import { useBookmarkStore } from "@/lib/store/bookmarkStore";
import PolicyCard from "@/app/components/ui/PolicyCard";
import OptionButton from "@/app/components/ui/OptionButton";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function BookmarkedScreen({ onNavigate }: ScreenProps) {
  const { bookmarks, toggle: toggleBookmark } = useBookmarkStore();
  const [activeTag, setActiveTag] = useState("#주거");
  const [upcomingOnly, setUpcomingOnly] = useState(false);

  const tags = ["#주거", "#청년", "#서울", "#월세"];

  // Filter bookmarked items
  let savedPolicies = policies.filter((p) => bookmarks.includes(p.id));

  // Tag filter logic
  if (activeTag === "#주거") {
    savedPolicies = savedPolicies.filter((p) => p.category === "주거");
  } else if (activeTag === "#서울") {
    savedPolicies = savedPolicies.filter((p) => p.location.includes("서울"));
  } else if (activeTag === "#월세") {
    savedPolicies = savedPolicies.filter((p) => p.title.includes("월세") || p.description.includes("월세"));
  }

  // Split into active and closed
  const ongoing = savedPolicies.filter((p) => p.dDay !== "마감됨");
  const closed = savedPolicies.filter((p) => p.dDay === "마감됨");

  // "곧 열림" checkbox filter (예정/곧 열려요)
  const displayedOngoing = upcomingOnly
    ? ongoing.filter((p) => p.dDay === "예정" || p.dDay === "곧 열려요")
    : ongoing;

  const handleCardClick = (id: string) => {
    onNavigate?.(`detail?id=${id}`);
  };

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-y-auto pt-[76px]">

      {/* Title & Share */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between shrink-0">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-1.5">
          찜한 정책
          <span className="text-blue-600 font-mono">{bookmarks.length}</span>
        </h2>
        <button
          onClick={() => alert("공유 링크가 클립보드에 복사되었습니다.")}
          className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"
        >
          <svg className="w-3.5 h-3.5 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 10.742l4.636-2.318m0 4.152l-4.636-2.318M18.822 5.75A6.38 6.38 0 1114.76 1.14m0 0a6.38 6.38 0 014.062 4.61" />
          </svg>
          공유
        </button>
      </div>

      {/* Filter Hashtags Scroll Row */}
      <div className="px-6 py-2.5 flex gap-2 overflow-x-auto shrink-0 scrollbar-none">
        {tags.map((tag) => (
          <OptionButton
            key={tag}
            label={tag}
            isActive={activeTag === tag}
            onClick={() => setActiveTag(tag)}
            className="px-4 py-1.5 rounded-full shrink-0"
          />
        ))}
      </div>

      {/* List Filter Checklist */}
      <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2 shrink-0">
        <span className="text-xs font-bold text-slate-500">진행 중인 정책</span>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={upcomingOnly}
            onChange={(e) => setUpcomingOnly(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4.5 w-4.5 transition-colors cursor-pointer"
          />
          <span className="text-xs font-bold text-slate-500">곧 열림</span>
        </label>
      </div>

      {/* Cards Scroll Container */}
      <div className="flex-1 px-6 py-5 space-y-6">
        
        {/* Section 1: 진행 중인 정책 */}
        <div className="space-y-4">
          <h4 className="text-[11px] font-extrabold text-slate-400 tracking-wide uppercase">진행 중인 정책</h4>
          
          {displayedOngoing.length === 0 ? (
            <p className="text-xs font-bold text-slate-500 text-center py-6">진행 중인 보관 정책이 없습니다.</p>
          ) : (
            displayedOngoing.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                isBookmarked={bookmarks.includes(policy.id)}
                onToggleBookmark={() => toggleBookmark(policy.id)}
                onClick={() => handleCardClick(policy.id)}
                showCategory={true}
                showLocation={true}
                showActionText={false}
              />
            ))
          )}
        </div>

        {/* Section 2: 마감된 정책 */}
        {!upcomingOnly && closed.length > 0 && (
          <div className="space-y-4 pt-2">
            <h4 className="text-[11px] font-extrabold text-slate-400 tracking-wide uppercase">마감된 정책</h4>
            
            {closed.map((policy) => (
              <div key={policy.id} className="opacity-70 hover:opacity-100 transition-opacity">
                <PolicyCard
                  policy={policy}
                  isBookmarked={bookmarks.includes(policy.id)}
                  onToggleBookmark={() => toggleBookmark(policy.id)}
                  onClick={() => handleCardClick(policy.id)}
                  showCategory={true}
                  showLocation={true}
                  showActionText={false}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
