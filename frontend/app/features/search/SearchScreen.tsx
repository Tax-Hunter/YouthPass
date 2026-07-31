"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useBookmarkStore } from "@/lib/store/bookmarkStore";
import { useAuthStore } from "@/lib/store/authStore";
import {
  useInfinitePolicyList,
  sortPoliciesByDeadline,
} from "@/lib/api/policy";
import { useChuncheonPolicyList } from "@/lib/api/chuncheon";
import { useInfiniteScrollSentinel } from "@/lib/useInfiniteScrollSentinel";
import { useFilterStore } from "@/lib/store/filterStore";
import { useUiStore } from "@/lib/store/uiStore";
import { useRecentSearchStore } from "@/lib/store/recentSearchStore";
import { useScrollPositionStore } from "@/lib/store/scrollPositionStore";
import { cityToSido } from "@/lib/sidoMap";
import { employmentToJobCodes } from "@/lib/jobCodeMap";
import PolicyCard from "@/app/components/ui/PolicyCard";
import FloatingFilterButton from "@/app/components/ui/FloatingFilterButton";
import ScreenContent from "@/app/components/layout/ScreenContent";

// 필터 오버레이는 열 때만 필요 — 정책 목록 초기 로드 번들에서 제외
const FilterScreen = dynamic(
  () => import("@/app/features/filter/FilterScreen"),
);

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
  const showClosedOnly = useUiStore((s) => s.showClosedOnly);
  const toggleShowClosedOnly = useUiStore((s) => s.toggleShowClosedOnly);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const setScrollPosition = useScrollPositionStore((s) => s.setScrollPosition);
  const getScrollPosition = useScrollPositionStore((s) => s.getScrollPosition);
  const { toggle: toggleBookmark, isBookmarked } = useBookmarkStore();
  const { filters, filterApplied, surveyAgeActive, _hasHydrated } =
    useFilterStore();
  // 검색을 연 이후엔 설문 개인화를 이 화면 안에서만 숨김 — 전역 상태는 건드리지 않아
  // 정책목록 등 다른 화면의 "첫 진입 시 설문 필터링" 동작에 영향 주지 않음
  const [searchDismissedSurvey, setSearchDismissedSurvey] = useState(false);
  // 설문을 새로 완료하면 이전에 검색을 열어 꺼뒀던 dismiss 상태를 초기화 — 렌더 중 비교라 useEffect 없이 처리
  const [prevSurveyAgeActive, setPrevSurveyAgeActive] =
    useState(surveyAgeActive);
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
    onNavigate?.("survey");
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
  const isSurveyDefault =
    surveyAgeActive && hasSurvey && !searchDismissedSurvey;
  const applyStoredFilters = isManualFilter || isSurveyDefault;
  // "춘천"은 시/도 매핑이 없는 별도 데이터 소스 — 일반 정책 검색(sido 기반) 대신
  // 춘천 프록시 API를 조회하고, 응답을 "춘천 지역 정책"/"전국 정책" 두 섹션으로 나눠 보여준다.
  const isChuncheonCity = applyStoredFilters && filters.city === "춘천";
  const sido = applyStoredFilters ? cityToSido(filters.city) : undefined;
  // 특정 시/도를 선택한 경우(전국 필터 제외) — 같은 목록 안에 섞여 오는 "전국 공통" 정책을
  // 별도 섹션으로 분리해서 보여준다(백엔드가 sido 필터에 전국 정책을 항상 포함해서 내려줌).
  const isSidoFilter = !!sido && !isChuncheonCity;
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
    _hasHydrated && !isChuncheonCity
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

  // 춘천 프록시 API는 로컬(춘천) 정책만 신뢰 — 데이터가 소수라 무한스크롤 없이 한 번에 조회.
  // 큐레이션에 섞여 오는 전국 정책은 외부 데이터 상태에 따라 있다 없다 하므로(Phase 3/5 조사)
  // 더 이상 여기서 쓰지 않고, 아래 자체 DB "전국 정책" 조회로 대체한다.
  const { data: chuncheonData, isLoading: isChuncheonLoading } =
    useChuncheonPolicyList(
      _hasHydrated && isChuncheonCity
        ? {
            ...(effectiveQuery ? { q: effectiveQuery } : {}),
            size: 100,
            ...(!showClosedOnly && { applicable: true }),
            ...(appliedCategories.length > 0 && { category: appliedCategories }),
          }
        : null,
    );
  const chuncheonProxyItems = chuncheonData?.items ?? [];
  const chuncheonLocalClosedFiltered = showClosedOnly
    ? chuncheonProxyItems.filter((p) => p.dday === "마감")
    : chuncheonProxyItems;
  const chuncheonLocalItems = sortPoliciesByDeadline(
    chuncheonLocalClosedFiltered.filter((p) => p.region === "춘천"),
  );

  // "춘천" 필터의 "전국 정책" 섹션 — 자체 정책 DB에서 nationwide=true로 직접 조회(무한스크롤 지원).
  // "춘천"은 sido 코드가 없어 일반 시/도 필터처럼 같은 쿼리에 전국 정책이 묻어오지 않기 때문에 별도 호출.
  const {
    items: chuncheonNationalItems,
    total: chuncheonNationalTotal,
    isLoading: isChuncheonNationalLoading,
    fetchNextPage: fetchNextChuncheonNationalPage,
    hasNextPage: hasNextChuncheonNationalPage,
    isFetchingNextPage: isFetchingNextChuncheonNationalPage,
  } = useInfinitePolicyList(
    _hasHydrated && isChuncheonCity
      ? {
          ...(effectiveQuery ? { q: effectiveQuery } : { sort: "recent" }),
          size: 20,
          nationwide: true,
          ...(!showClosedOnly && { applicable: true }),
          ...(appliedCategories.length > 0 && { category: appliedCategories }),
        }
      : null,
  );
  const chuncheonNationalClosedFiltered = showClosedOnly
    ? chuncheonNationalItems.filter((p) => p.dday === "마감")
    : chuncheonNationalItems;
  const sortedChuncheonNationalItems = sortPoliciesByDeadline(
    chuncheonNationalClosedFiltered,
  );

  const showSkeleton = isChuncheonCity
    ? !_hasHydrated || isChuncheonLoading || isChuncheonNationalLoading
    : !_hasHydrated || isLoading;

  // 검색어(또는 전체 목록)별로 스크롤 위치를 구분 저장 — 키가 바뀌면 새 검색으로 간주해
  // 자연스럽게 처음부터 시작하고, 같은 키로 돌아오면(뒤로가기) 마지막 위치를 복원
  const scrollKey = `search:${effectiveQuery || "__all__"}`;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrollPosition(scrollKey, el.scrollTop);
        ticking = false;
      });
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [scrollKey, setScrollPosition]);

  useEffect(() => {
    if (showSkeleton) return;
    const el = scrollRef.current;
    if (!el) return;
    const saved = getScrollPosition(scrollKey);
    if (saved) el.scrollTop = saved;
  }, [showSkeleton, scrollKey, getScrollPosition]);

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

  // 춘천 프록시 API 출처 카드(로컬/전국 두 섹션 공통)는 상세 조회도 같은 프록시 상세 엔드포인트를 써야 함
  const handleChuncheonCardClick = (plcy_no: string) => {
    onNavigate?.(`detail?id=${plcy_no}&src=chuncheon`);
  };

  // 전체 개수 표시는 기존 규약(마감 토글 ON일 땐 숨김, 클라이언트 dday 필터와 무관하게 API total 기준)을
  // 그대로 따른다 — 로컬(춘천)은 페이지네이션이 없어 실제 개수, 전국은 무한스크롤 쿼리의 total.
  const chuncheonResultCount = chuncheonLocalItems.length + (chuncheonNationalTotal ?? 0);

  // 일반 시/도 필터 — "{시/도} 정책"/"전국 정책" 두 그룹으로 나누고, 그룹 내부에서만 정렬.
  // 무한스크롤로 페이지가 늘어도 로컬 섹션은 항상 위, 전국 섹션은 항상 아래로 고정된다.
  const sidoLocalItems = sortPoliciesByDeadline(
    closedFilteredItems.filter((p) => p.region !== "전국 공통"),
  );
  const sidoNationalItems = sortPoliciesByDeadline(
    closedFilteredItems.filter((p) => p.region === "전국 공통"),
  );

  const sortedItems =
    closedFilteredItems.length > 0
      ? sortPoliciesByDeadline(closedFilteredItems)
      : null;

  const sentinelRef = useInfiniteScrollSentinel(
    fetchNextPage,
    hasNextPage && !isFetchingNextPage,
  );

  // 춘천 필터의 "전국 정책" 섹션 전용 무한스크롤 sentinel(로컬 섹션은 페이지네이션 없음)
  const chuncheonNationalSentinelRef = useInfiniteScrollSentinel(
    fetchNextChuncheonNationalPage,
    hasNextChuncheonNationalPage && !isFetchingNextChuncheonNationalPage,
  );

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-hidden relative">
      <ScreenContent ref={scrollRef} bottomPadding="24">
        {/* 설문 미실시 시에만 노출되는 설문 유도 배너 */}
        {!surveyCompleted && _hasHydrated && (
          <div className="pt-4">
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

        {/* Recent Searches — 항상 이 자리를 차지해서 아래 콘텐츠가 밀리지 않음. 검색창은 이 위에 오버레이 */}
        {(recentSearches.length > 0 || isSearchOpen) && (
          <div className="relative min-h-15.5 shrink-0">
            {recentSearches.length > 0 && (
              <div className="pt-5">
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
              <div className="absolute inset-0 z-20 bg-white flex items-center pt-5 pb-2">
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
        <div className="pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-800">
              {effectiveQuery ? "검색 결과" : showClosedOnly ? "마감" : "전체"}
            </span>
            {!showSkeleton && !showClosedOnly && (
              <span className="text-xs font-bold text-blue-600 font-mono">
                {isChuncheonCity ? chuncheonResultCount : total}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggleShowClosedOnly()}
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

        {isChuncheonCity ? (
          <div className="py-4">
            {showSkeleton ? (
              <div className="space-y-5">
                {Array.from({ length: 3 }).map((_, i) => (
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
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {/* 춘천 로컬 정책 — 0건이어도 섹션은 유지해 "춘천" 필터를 선택했음을 계속 보여줌 */}
                <section className="space-y-5">
                  <h3 className="text-sm font-bold text-slate-900">
                    춘천 지역 정책
                  </h3>
                  {chuncheonLocalItems.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 py-2">
                      진행 중인 정책이 없습니다.
                    </p>
                  ) : (
                    chuncheonLocalItems.map((policy) => (
                      <PolicyCard
                        key={policy.plcy_no}
                        policy={policy}
                        isBookmarked={false}
                        onToggleBookmark={() => {}}
                        onClick={() => handleChuncheonCardClick(policy.plcy_no)}
                        source="chuncheon"
                        showCategory={true}
                        showLocation={true}
                        showActionText={true}
                        showBookmark={false}
                      />
                    ))
                  )}
                </section>

                {/* "춘천"은 sido 코드가 없어 자체 DB에서 nationwide=true로 별도 조회한 전국 정책 — 무한스크롤 */}
                <section className="space-y-5">
                  <div className="mb-0.5">
                    <h3 className="text-sm font-bold text-slate-900">
                      전국 정책
                    </h3>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                      춘천 청년에게 추천하는 전국 단위 정책이에요
                    </p>
                  </div>
                  {sortedChuncheonNationalItems.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 py-2">
                      진행 중인 정책이 없습니다.
                    </p>
                  ) : (
                    sortedChuncheonNationalItems.map((policy) => (
                      <PolicyCard
                        key={policy.plcy_no}
                        policy={policy}
                        isBookmarked={false}
                        onToggleBookmark={() => {}}
                        onClick={() => handleCardClick(policy.plcy_no)}
                        showCategory={true}
                        showLocation={true}
                        showActionText={true}
                        showBookmark={false}
                      />
                    ))
                  )}
                  <div ref={chuncheonNationalSentinelRef} className="h-4">
                    {isFetchingNextChuncheonNationalPage && (
                      <div className="flex justify-center py-2">
                        <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        ) : isSidoFilter ? (
          <div className="py-4">
            {showSkeleton ? (
              <div className="space-y-5">
                {Array.from({ length: 3 }).map((_, i) => (
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
                ))}
              </div>
            ) : sidoLocalItems.length === 0 && sidoNationalItems.length === 0 ? (
              <div className="text-center py-10 flex flex-col items-center gap-2">
                <Image
                  src="/images/mascot/search.png"
                  alt=""
                  draggable={false}
                  width={320}
                  height={213}
                  className="w-20 h-auto object-contain select-none pointer-events-none mb-1"
                />
                <p className="text-xs font-bold text-slate-400">
                  검색 결과가 없습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* 로컬(선택한 시/도) 섹션 — 항상 위에 고정, 그룹 내부에서만 정렬 */}
                <section className="space-y-5">
                  <h3 className="text-sm font-bold text-slate-900">
                    {filters.city} 정책
                  </h3>
                  {sidoLocalItems.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 py-2">
                      진행 중인 정책이 없습니다.
                    </p>
                  ) : (
                    sidoLocalItems.map((policy) => (
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
                </section>

                {/* 전국 공통 섹션 — 항상 아래에 고정, 같은 무한스크롤 쿼리 결과에서 분리 */}
                <section className="space-y-5">
                  <h3 className="text-sm font-bold text-slate-900">
                    전국 정책
                  </h3>
                  {sidoNationalItems.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 py-2">
                      진행 중인 정책이 없습니다.
                    </p>
                  ) : (
                    sidoNationalItems.map((policy) => (
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
                </section>

                <div ref={sentinelRef} className="h-4">
                  {isFetchingNextPage && (
                    <div className="flex justify-center py-2">
                      <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 space-y-5">
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
              <div className="text-center py-10 flex flex-col items-center gap-2">
                <Image
                  src="/images/mascot/search.png"
                  alt=""
                  draggable={false}
                  width={320}
                  height={213}
                  className="w-20 h-auto object-contain select-none pointer-events-none mb-1"
                />
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
        )}
      </ScreenContent>

      <FloatingFilterButton
        onClick={() => setIsFilterOpen(true)}
        active={applyStoredFilters}
      />

      {isFilterOpen && (
        <div className="absolute inset-0 z-50">
          <FilterScreen onNavigate={() => setIsFilterOpen(false)} />
        </div>
      )}
    </div>
  );
}
