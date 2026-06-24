"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { policies } from "@/app/data/policies";
import { useBookmarks } from "@/app/features/bookmarks/useBookmarks";
import { useFilters } from "@/app/features/filter/useFilters";
import PolicyCard from "@/app/components/ui/PolicyCard";
import FloatingFilterButton from "@/app/components/ui/FloatingFilterButton";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function PolicyListScreen({ onNavigate }: ScreenProps) {
  const router = useRouter();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { filters } = useFilters();
  const [activeCategory, setActiveCategory] = useState("전체");

  // Filter based on state hooks
  const displayed = policies.filter((p) => {
    // Category check
    if (activeCategory !== "전체" && p.category !== activeCategory) {
      return false;
    }
    // Location check
    if (filters.district !== "전체" && !p.location.includes(filters.district)) {
      return false;
    }
    // Employment check
    if (filters.employment && !p.employment.includes(filters.employment as any)) {
      return false;
    }
    return true;
  });

  const handleCardClick = (id: string) => {
    onNavigate?.(`detail?id=${id}`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 font-sans select-none overflow-hidden relative">
      {/* Main List */}
      <div className="flex-1 overflow-y-auto px-5 pb-24 pt-[96px] space-y-4">
        {displayed.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs font-bold text-slate-400">조건에 부합하는 정책이 없습니다.</p>
          </div>
        ) : (
          displayed.map((policy) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              isBookmarked={isBookmarked(policy.id)}
              onToggleBookmark={() => toggleBookmark(policy.id)}
              onClick={() => handleCardClick(policy.id)}
              showCategory={true}
              showLocation={true}
              showActionText={true}
            />
          ))
        )}
      </div>

      {/* Floating Bottom Button for Filters */}
      <FloatingFilterButton 
        onClick={() => onNavigate?.("filter")}
        onMouseEnter={() => {
          router.prefetch("/filter");
        }}
      />
    </div>
  );
}
