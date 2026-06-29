"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBookmarkStore } from "@/lib/store/bookmarkStore";
import { usePolicyList } from "@/lib/api/policy";
import PolicyCard from "@/app/components/ui/PolicyCard";
import FloatingFilterButton from "@/app/components/ui/FloatingFilterButton";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function SearchScreen({ onNavigate }: ScreenProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(["월세 지원", "청년 주거", "전세 대출"]);
  const { toggle: toggleBookmark, isBookmarked } = useBookmarkStore();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data, isLoading } = usePolicyList(
    debouncedTerm ? { q: debouncedTerm, size: 20 } : null
  );

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

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-hidden relative pt-19">

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
        {!debouncedTerm ? (
          <div className="text-center py-16">
            <p className="text-xs font-bold text-slate-400">검색어를 입력해 주세요</p>
          </div>
        ) : (
          <>
            <div className="px-6 pt-4 pb-2 flex items-center gap-1.5 border-t border-slate-50 mt-3">
              <span className="text-xs font-bold text-slate-800">검색 결과</span>
              <span className="text-xs font-bold text-blue-600 font-mono">{data?.total ?? 0}</span>
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
              ) : !data || data.items.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs font-bold text-slate-400">검색 결과가 없습니다.</p>
                </div>
              ) : (
                data.items.map((policy) => (
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
            </div>
          </>
        )}
      </div>

      <FloatingFilterButton
        onClick={() => router.push("/filter?from=search")}
        onMouseEnter={() => router.prefetch("/filter")}
      />
    </div>
  );
}
