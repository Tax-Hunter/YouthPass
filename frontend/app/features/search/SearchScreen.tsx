"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBookmarkStore } from "@/lib/store/bookmarkStore";
import { useInfinitePolicyList, sortPoliciesByDeadline } from "@/lib/api/policy";
import { useInfiniteScrollSentinel } from "@/lib/useInfiniteScrollSentinel";
import PolicyCard from "@/app/components/ui/PolicyCard";
import FloatingFilterButton from "@/app/components/ui/FloatingFilterButton";
import FilterScreen from "@/app/features/filter/FilterScreen";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function SearchScreen({ onNavigate }: ScreenProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(["월세 지원", "청년 주거", "전세 대출"]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showClosedOnly, setShowClosedOnly] = useState(false);
  const { toggle: toggleBookmark, isBookmarked } = useBookmarkStore();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { items, total, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfinitePolicyList({
    ...(debouncedTerm ? { q: debouncedTerm } : { sort: "recent" }),
    size: 20,
    ...(showClosedOnly ? { closed_only: true } : { applicable: true }),
  });

  // closed_only는 배포된 백엔드가 아직 지원 안 할 수 있어 dday로 한 번 더 걸러 안전하게 보장
  // (배포 이후엔 서버가 이미 걸러주므로 아래 필터는 그냥 통과만 함)
  const closedFilteredItems = showClosedOnly ? items.filter((p) => p.dday === "마감") : items;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;
    setDebouncedTerm(term);
    if (!recentSearches.includes(term)) {
      setRecentSearches((prev) => [term, ...prev.slice(0, 4)]);
    }
  };

  const handleRecentClick = (term: string) => {
    setSearchTerm(term);
    setDebouncedTerm(term);
  };

  const handleCardClick = (plcy_no: string) => {
    onNavigate?.(`detail?id=${plcy_no}`);
  };

  const sortedItems = closedFilteredItems.length > 0 ? sortPoliciesByDeadline(closedFilteredItems) : null;

  const sentinelRef = useInfiniteScrollSentinel(fetchNextPage, hasNextPage && !isFetchingNextPage);

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-hidden relative pt-header">

      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="px-6 py-2 shrink-0">
        <div className="relative">
          <button
            type="submit"
            className="absolute inset-y-0 left-0 pl-4 flex items-center text-blue-600 hover:text-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="검색어를 입력해 주세요"
            className="w-full pl-11 pr-11 py-3.5 border border-slate-100 bg-slate-50 text-[14px] font-semibold rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white focus:shadow-sm transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => { setSearchTerm(""); setDebouncedTerm(""); }}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
        </div>
      </form>

      <div className="flex-1 overflow-y-auto pb-24">

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div className="px-6 pt-5 pb-3 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">최근 검색어</span>
              <button
                type="button"
                onClick={() => setRecentSearches([])}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 hover:underline"
              >
                전체 삭제
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleRecentClick(term)}
                  className="px-3.5 py-1.5 bg-slate-100/70 hover:bg-slate-200 border border-slate-100 text-slate-600 rounded-full text-xs font-semibold transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between border-t border-slate-50 mt-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-800">
              {debouncedTerm ? "검색 결과" : showClosedOnly ? "마감 정책" : "전체 정책"}
            </span>
            {!isLoading && !showClosedOnly && <span className="text-xs font-bold text-blue-600 font-mono">{total}</span>}
          </div>
          <button
            type="button"
            onClick={() => setShowClosedOnly((prev) => !prev)}
            className="flex items-center gap-1.5"
          >
            <span className="text-[11px] font-bold text-slate-500">마감 정책만 보기</span>
            <span
              className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                showClosedOnly ? "bg-blue-600 justify-end" : "bg-slate-200 justify-start"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </span>
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
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
          ) : !sortedItems || sortedItems.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs font-bold text-slate-400">검색 결과가 없습니다.</p>
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
                showActionText={true}
              />
            ))
          )}
          {sortedItems && sortedItems.length > 0 && (
            <div ref={sentinelRef} className="h-4">
              {isFetchingNextPage && (
                <div className="flex justify-center py-2">
                  <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <FloatingFilterButton
        onClick={() => setIsFilterOpen(true)}
      />

      {isFilterOpen && (
        <div className="absolute inset-0 z-50">
          <FilterScreen onNavigate={() => setIsFilterOpen(false)} />
        </div>
      )}
    </div>
  );
}
