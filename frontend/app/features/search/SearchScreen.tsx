"use client";

import React, { useState, useEffect, useRef } from "react";
import { useBookmarkStore } from "@/lib/store/bookmarkStore";
import { useAuthStore } from "@/lib/store/authStore";
import {
  useInfinitePolicyList,
  sortPoliciesByDeadline,
} from "@/lib/api/policy";
import { useInfiniteScrollSentinel } from "@/lib/useInfiniteScrollSentinel";
import { useFilterStore } from "@/lib/store/filterStore";
import { useUiStore } from "@/lib/store/uiStore";
import { useRecentSearchStore } from "@/lib/store/recentSearchStore";
import { cityToSido } from "@/lib/sidoMap";
import { employmentToJobCodes } from "@/lib/jobCodeMap";
import PolicyCard from "@/app/components/ui/PolicyCard";
import FloatingFilterButton from "@/app/components/ui/FloatingFilterButton";
import FilterScreen from "@/app/features/filter/FilterScreen";
import SurveyScreen from "@/app/features/auth/SurveyScreen";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfhwYHXLamf7R0XRJS-jLhsu43Pj8wWKfhuYOnafhyv9Mzx2A/viewform";

export default function SearchScreen({ onNavigate }: ScreenProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const isSearchOpen = useUiStore((s) => s.searchInputOpen);
  const toggleSearchInput = useUiStore((s) => s.toggleSearchInput);
  const closeSearchInput = useUiStore((s) => s.closeSearchInput);
  const openLoginModal = useUiStore((s) => s.openLoginModal);
  const { recentSearches, addRecentSearch, clearRecentSearches } =
    useRecentSearchStore();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);
  const [showClosedOnly, setShowClosedOnly] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toggle: toggleBookmark, isBookmarked } = useBookmarkStore();
  const { filters, filterApplied, surveyAgeActive, _hasHydrated } = useFilterStore();
  // 검색을 연 이후엔 설문 개인화를 이 화면 안에서만 숨김 — 전역 상태는 건드리지 않아
  // 정책목록 등 다른 화면의 "첫 진입 시 설문 필터링" 동작에 영향 주지 않음
  const [searchDismissedSurvey, setSearchDismissedSurvey] = useState(false);
  // 설문을 새로 완료하면(같은 화면에서 오버레이로 완료해 리마운트가 안 일어나는 경우 포함)
  // 이전에 검색을 열어 꺼뒀던 dismiss 상태를 초기화 — 렌더 중 비교라 useEffect 없이 처리
  const [prevSurveyAgeActive, setPrevSurveyAgeActive] = useState(surveyAgeActive);
  if (surveyAgeActive !== prevSurveyAgeActive) {
    setPrevSurveyAgeActive(surveyAgeActive);
    if (surveyAgeActive) setSearchDismissedSurvey(false);
  }
  const { user } = useAuthStore();

  const openSurvey = () => {
    if (!user) {
      openLoginModal();
      return;
    }
    setIsSurveyOpen(true);
  };

  const openGoogleForm = () => {
    window.open(GOOGLE_FORM_URL, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const wasSearchOpenRef = useRef(isSearchOpen);
  const skipNextResetRef = useRef(false);

  useEffect(() => {
    const wasOpen = wasSearchOpenRef.current;
    wasSearchOpenRef.current = isSearchOpen;
    if (!isSearchOpen || wasOpen) return;
    // 검색을 새로 열면 설문으로 자동 적용됐던 필터(나이·지역·카테고리)는 이 화면에서만 숨김 —
    // 검색은 항상 전체 정책 대상으로 시작하고, 이후엔 사용자가 필터에서 직접 고른 조건만 반영
    setSearchDismissedSurvey(true);
    // 검색 아이콘으로 새로 열릴 때는 이전 검색어를 지우고 빈 입력으로 시작
    // (최근 검색어 클릭으로 열리는 경우는 handleRecentClick에서 skipNextResetRef로 예외 처리)
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
    } else {
      setSearchTerm("");
      setDebouncedTerm("");
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isSearchOpen]);

  const effectiveQuery = isSearchOpen ? debouncedTerm : "";

  const hasSurvey = filters.age != null;
  // 설문 완료 배너는 서버에 기록된 완료 여부(user.survey_completed)를 우선 신뢰 —
  // 로컬 filters.age가 초기화/미동기화된 상태에서도 완료된 사용자에게 배너가 다시 뜨지 않도록 함
  const surveyCompleted = !!user?.survey_completed || hasSurvey;
  // 사용자가 필터 화면에서 직접 적용한 상태(surveyAgeActive=false)면 city/category도 사용자가 고른 값 그대로 신뢰
  const isManualFilter = filterApplied && !surveyAgeActive;
  // 설문 직후 개인화는 이 화면에서 검색을 열기 전 기본 목록에서만 반영 — 검색을 열면 즉시 숨김
  // (전역 surveyAgeActive는 그대로 둬서 정책목록 등 다른 화면엔 영향 없음)
  const isSurveyDefault = surveyAgeActive && hasSurvey && !searchDismissedSurvey;
  const applyStoredFilters = isManualFilter || isSurveyDefault;
  const sido = applyStoredFilters ? cityToSido(filters.city) : undefined;
  const appliedCategories = applyStoredFilters
    ? Object.entries(filters.categories)
        .filter(([, v]) => v)
        .map(([k]) => k)
    : [];
  const appliedJobCodes = isManualFilter
    ? employmentToJobCodes(filters.employment)
    : [];

  const {
    items,
    total,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfinitePolicyList(
    _hasHydrated
      ? {
          ...(effectiveQuery ? { q: effectiveQuery } : { sort: "recent" }),
          size: 20,
          // 백엔드에 마감만 조회하는 파라미터가 없어(applicable=true는 "마감 제외"만 지원),
          // 토글 OFF일 때만 applicable=true로 마감 제외 조회하고 ON일 때는 무필터로 받아 dday로 클라이언트 필터링
          ...(!showClosedOnly && { applicable: true }),
          ...(sido && { sido }),
          ...(isSurveyDefault && { age: filters.age as number }),
          ...(appliedCategories.length > 0 && { category: appliedCategories }),
          ...(appliedJobCodes.length > 0 && { job: appliedJobCodes }),
        }
      : null,
  );

  const showSkeleton = !_hasHydrated || isLoading;

  const closedFilteredItems = showClosedOnly
    ? items.filter((p) => p.dday === "마감")
    : items;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;
    setDebouncedTerm(term);
    addRecentSearch(term);
  };

  const handleRecentClick = (term: string) => {
    skipNextResetRef.current = true;
    setSearchTerm(term);
    setDebouncedTerm(term);
    toggleSearchInput();
  };

  const handleCardClick = (plcy_no: string) => {
    onNavigate?.(`detail?id=${plcy_no}`);
  };

  const sortedItems =
    closedFilteredItems.length > 0
      ? sortPoliciesByDeadline(closedFilteredItems)
      : null;

  const sentinelRef = useInfiniteScrollSentinel(
    fetchNextPage,
    hasNextPage && !isFetchingNextPage,
  );

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-hidden relative">
      <div className="flex-1 min-h-0 overflow-y-auto pt-header pb-24">
        {/* 설문 미실시 시에만 노출되는 설문 유도 배너 */}
        {!surveyCompleted && _hasHydrated && (
          <div className="px-screen pt-4">
            <button
              onClick={openSurvey}
              className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl text-left active:scale-[0.99] transition-all"
            >
              <div>
                <p className="text-[12px] font-extrabold text-blue-700">
                  설문을 완료하면 맞춤 정책을 추천해드려요
                </p>
                <p className="text-[9px] text-blue-500 font-semibold mt-0.5">
                  나이·지역·관심분야 1분 설정
                </p>
              </div>
              <svg
                className="w-4 h-4 text-blue-500 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}

        {/* 구글폼 설문하기 배너 — 기존 설문 완료 여부와 무관하게 항상 노출 */}
        <div className="px-screen pt-2">
          <button
            onClick={openGoogleForm}
            className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-left active:scale-[0.99] transition-all"
          >
            <div>
              <p className="text-[12px] font-extrabold text-indigo-700">
                청년패스 베타테스트 설문에 참여해주세요 
              </p>
              <p className="text-[9px] text-indigo-500 font-semibold mt-0.5">
                ( 7.10 ~ 7.20 ) 서비스 개선을 위한 의견을 들려주세요
              </p>
            </div>
            <svg
              className="w-4 h-4 text-indigo-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* Recent Searches — 항상 이 자리를 차지해서 아래 콘텐츠가 밀리지 않음. 검색창은 이 위에 오버레이 */}
        {(recentSearches.length > 0 || isSearchOpen) && (
          <div className="relative min-h-15.5 shrink-0">
            {recentSearches.length > 0 && (
              <div className="px-screen pt-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-800">
                    최근 검색
                  </span>
                  <button
                    type="button"
                    onClick={() => clearRecentSearches()}
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
                      {term.length > 6 ? `${term.slice(0, 6)}...` : term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isSearchOpen && (
              <div className="absolute inset-0 z-20 bg-white flex items-center px-screen pt-5 pb-2">
                <form onSubmit={handleSearchSubmit} className="relative w-full">
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="검색어를 입력해 주세요"
                    className="w-full pl-5 pr-11 py-3.5 border border-slate-100 bg-slate-50 text-base font-semibold rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white focus:shadow-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={closeSearchInput}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        <div className="px-screen pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-800">
              {effectiveQuery ? "검색 결과" : showClosedOnly ? "마감" : "전체"}
            </span>
            {!showSkeleton && !showClosedOnly && (
              <span className="text-xs font-bold text-blue-600 font-mono">
                {total}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowClosedOnly((prev) => !prev)}
            className="flex items-center gap-1.5"
          >
            <span className="text-[11px] font-bold text-slate-500">
              마감 정책
            </span>
            <span
              className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                showClosedOnly
                  ? "bg-blue-600 justify-end"
                  : "bg-slate-200 justify-start"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </span>
          </button>
        </div>

        <div className="px-screen py-4 space-y-5">
          {showSkeleton ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-5 bg-white border border-slate-100 rounded-2xl animate-pulse"
              >
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
              <p className="text-xs font-bold text-slate-400">
                검색 결과가 없습니다.
              </p>
            </div>
          ) : (
            sortedItems.map((policy) => (
              <PolicyCard
                key={policy.plcy_no}
                policy={policy}
                isBookmarked={!!user && isBookmarked(policy.plcy_no)}
                onToggleBookmark={() => toggleBookmark(policy.plcy_no)}
                onClick={() => handleCardClick(policy.plcy_no)}
                showCategory={true}
                showLocation={true}
                showActionText={true}
                showBookmark={!!user}
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
        active={applyStoredFilters}
      />

      {isFilterOpen && (
        <div className="absolute inset-0 z-50">
          <FilterScreen onNavigate={() => setIsFilterOpen(false)} />
        </div>
      )}

      {isSurveyOpen && (
        <div className="absolute inset-0 z-50 bg-white">
          <SurveyScreen onNavigate={() => setIsSurveyOpen(false)} />
        </div>
      )}
    </div>
  );
}
