"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { policies } from "@/app/data/policies";
import { useBookmarkStore } from "@/lib/store/bookmarkStore";
import { useHydrated } from "@/lib/useHydrated";
import PolicyCard from "@/app/components/ui/PolicyCard";
import FloatingFilterButton from "@/app/components/ui/FloatingFilterButton";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function SearchScreen({ onNavigate }: ScreenProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("월세");
  const [recentSearches, setRecentSearches] = useState(["월세 지원", "청년 주거", "전세 대출"]);
  const { toggle: toggleBookmark, isBookmarked } = useBookmarkStore();
  const hydrated = useHydrated();

  const clearSearch = () => setSearchTerm("");
  const deleteRecent = () => setRecentSearches([]);

  const handleRecentClick = (term: string) => {
    setSearchTerm(term);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim() && !recentSearches.includes(searchTerm.trim())) {
      setRecentSearches((prev) => [searchTerm.trim(), ...prev.slice(0, 4)]);
    }
  };

  // Filter policies based on search terms
  const searchResults = policies.filter((p) => {
    if (!searchTerm.trim()) return true;
    const query = searchTerm.toLowerCase();
    return (
      p.title.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query)
    );
  });

  const handleCardClick = (id: string) => {
    onNavigate?.(`detail?id=${id}`);
  };

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-hidden relative pt-[76px]">

      {/* Search Input Box */}
      <form onSubmit={handleSearchSubmit} className="px-6 py-2 shrink-0">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
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
              onClick={clearSearch}
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
              onClick={deleteRecent}
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

      {/* Search Results Label */}
      <div className="px-6 pt-4 pb-2 flex items-center gap-1.5 shrink-0 border-t border-slate-50 mt-3">
        <span className="text-xs font-bold text-slate-800">검색 결과</span>
        <span className="text-xs font-bold text-blue-600 font-mono">{searchResults.length}</span>
      </div>

      {/* Search results list */}
      <div className="px-6 py-4 space-y-5">
        {searchResults.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-xs font-bold text-slate-400">검색 결과가 없습니다.</p>
          </div>
        ) : (
          searchResults.map((policy) => {
            const isFav = hydrated && isBookmarked(policy.id);
            if (policy.isFeatured) {
              return (
                <div
                  key={policy.id}
                  onClick={() => handleCardClick(policy.id)}
                  className="relative overflow-hidden rounded-[20px] shadow-sm hover:shadow-md transition-all cursor-pointer group"
                  style={{ aspectRatio: "16/9" }}
                >
                  <img
                    src="https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=500&q=80"
                    alt={policy.title}
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute inset-x-5 bottom-5 z-10 flex flex-col items-start gap-2">
                    <span className="text-[9px] font-extrabold text-white bg-slate-800/80 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Featured
                    </span>
                    <h4 className="text-[15px] font-extrabold text-white leading-tight">
                      {policy.title}
                    </h4>
                  </div>
                </div>
              );
            }
            return (
              <PolicyCard
                key={policy.id}
                policy={policy}
                isBookmarked={hydrated && isBookmarked(policy.id)}
                onToggleBookmark={() => toggleBookmark(policy.id)}
                onClick={() => handleCardClick(policy.id)}
                showCategory={true}
                showLocation={true}
                showActionText={true}
              />
            );
          })
        )}
      </div>

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
