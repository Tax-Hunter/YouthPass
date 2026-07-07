"use client";

import React, { useEffect, useState } from "react";
import { useBookmarkStore } from "@/lib/store/bookmarkStore";
import { usePolicyDetail } from "@/lib/api/policy";
import type { PolicyCardData } from "@/lib/api/policy";
import PolicyCard from "@/app/components/ui/PolicyCard";
import OptionButton from "@/app/components/ui/OptionButton";
import ShareButton from "@/app/components/ui/ShareButton";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

function BookmarkedCard({
  plcy_no,
  isBookmarked,
  onToggleBookmark,
  onClick,
  activeTag,
  onInvalid,
}: {
  plcy_no: string;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onClick: () => void;
  activeTag: string;
  onInvalid: (plcy_no: string) => void;
}) {
  const { policy, error, isLoading } = usePolicyDetail(plcy_no);

  // 존재하지 않는 정책(삭제되었거나 레거시 id)은 찜 목록에서 자동으로 제거한다.
  useEffect(() => {
    if (error) onInvalid(plcy_no);
  }, [error, plcy_no, onInvalid]);

  if (isLoading) {
    return (
      <div className="p-5 bg-white border border-slate-100 rounded-2xl animate-pulse">
        <div className="flex justify-between mb-3">
          <div className="h-5 w-14 bg-slate-200 rounded-full" />
          <div className="h-5 w-10 bg-slate-200 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded-md w-11/12" />
          <div className="h-3 bg-slate-200 rounded-md w-7/12" />
        </div>
      </div>
    );
  }

  if (!policy) return null;

  if (activeTag !== "전체" && policy.category !== activeTag.replace("#", ""))
    return null;

  const card: PolicyCardData = {
    plcy_no: policy.plcy_no,
    plcy_nm: policy.plcy_nm,
    category: policy.category,
    region: policy.region,
    summary: policy.plcy_expln_cn,
    dday: policy.dday,
    days: policy.days,
    views: policy.views,
    is_always_open: policy.is_always_open,
    apply_end_date: policy.apply_end_date,
  };

  return (
    <PolicyCard
      policy={card}
      isBookmarked={isBookmarked}
      onToggleBookmark={onToggleBookmark}
      onClick={onClick}
      showCategory={true}
      showLocation={true}
      showActionText={false}
    />
  );
}

export default function BookmarkedScreen({ onNavigate }: ScreenProps) {
  const {
    bookmarks,
    toggle: toggleBookmark,
    isBookmarked,
  } = useBookmarkStore();
  const [activeTag, setActiveTag] = useState("전체");

  const tags = ["전체", "#주거", "#금융", "#일자리", "#교육"];

  const handleCardClick = (plcy_no: string) => {
    onNavigate?.(`detail?id=${plcy_no}`);
  };

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-y-auto scroll-stable pt-header">
      {/* Title & Share */}
      <div className="px-screen pt-5 pb-3 flex items-center justify-between shrink-0">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-1.5">
          찜한 정책
          <span className="text-blue-600 font-mono">{bookmarks.length}</span>
        </h2>
        <ShareButton className="text-xs font-bold" />
      </div>

      {/* Filter Hashtags */}
      <div className="px-screen py-2.5 flex flex-wrap gap-2 shrink-0">
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

      <div className="border-t border-slate-50" />

      {/* Cards */}
      <div className="flex-1 px-screen py-5 space-y-4">
        {bookmarks.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-2">
            <svg
              className="w-10 h-10 text-slate-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <p className="text-xs font-bold text-slate-400">
              찜한 정책이 없습니다.
            </p>
          </div>
        ) : (
          bookmarks.map((plcy_no) => (
            <BookmarkedCard
              key={plcy_no}
              plcy_no={plcy_no}
              isBookmarked={isBookmarked(plcy_no)}
              onToggleBookmark={() => toggleBookmark(plcy_no)}
              onClick={() => handleCardClick(plcy_no)}
              activeTag={activeTag}
              onInvalid={toggleBookmark}
            />
          ))
        )}
      </div>
    </div>
  );
}
