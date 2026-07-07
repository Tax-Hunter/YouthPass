"use client";

import { useState } from "react";
import { useBookmarkStore } from "@/lib/store/bookmarkStore";
import { useInfinitePolicyList, sortPoliciesByDeadline } from "@/lib/api/policy";
import { useInfiniteScrollSentinel } from "@/lib/useInfiniteScrollSentinel";
import { useFilterStore } from "@/lib/store/filterStore";
import { cityToSido } from "@/lib/sidoMap";
import PolicyCard from "@/app/components/ui/PolicyCard";
import FloatingFilterButton from "@/app/components/ui/FloatingFilterButton";
import FilterScreen from "@/app/features/filter/FilterScreen";
import SurveyScreen from "@/app/features/auth/SurveyScreen";
import { useRouter } from "next/navigation";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function PolicyListScreen({ onNavigate }: ScreenProps) {
  const router = useRouter();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);
  const { isBookmarked, toggle: toggleBookmark } = useBookmarkStore();
  const { filters, filterApplied, _hasHydrated } = useFilterStore();

  const hasSurvey = filters.age != null;
  const applyLocation = hasSurvey || filterApplied;
  const sido = applyLocation ? cityToSido(filters.city) : undefined;
  // 매칭 점수 기반 추천 정렬(sort=recommended)은 백엔드 미구현으로 임시 비활성화.
  // 복구 시 `useAuthStore`에서 user를 다시 가져와 `!!user?.survey_completed`로 되돌리기
  // — workflow/9_feat/phase6_설문정책매칭.md 참고.
  const useRecommended = false;

  const appliedCategories = (hasSurvey || filterApplied)
    ? Object.entries(filters.categories).filter(([, v]) => v).map(([k]) => k)
    : [];

  const listParams = _hasHydrated
    ? {
        sort: useRecommended ? ("recommended" as const) : ("recent" as const),
        ...(sido && { sido }),
        ...(hasSurvey && {
          age: filters.age as number,
          applicable: true,
        }),
        ...(appliedCategories.length > 0 && { category: appliedCategories }),
      }
    : null;

  const { items, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfinitePolicyList(listParams);

  // 추천 정렬은 백엔드가 매긴 점수 순서를 그대로 유지(마감일 재정렬로 순위가 뒤섞이지 않도록)
  const sortedItems = items.length === 0 ? null : useRecommended ? items : sortPoliciesByDeadline(items);

  const sentinelRef = useInfiniteScrollSentinel(fetchNextPage, hasNextPage && !isFetchingNextPage);

  const handleCardClick = (plcy_no: string) => {
    onNavigate?.(`detail?id=${plcy_no}`);
  };

  const showSkeleton = !_hasHydrated || isLoading;

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 font-sans select-none overflow-hidden relative">
      <div className="flex-1 overflow-y-auto scroll-stable px-5 pb-24 pt-header-list space-y-4">
        {!hasSurvey && _hasHydrated && (
          <button
            onClick={() => setIsSurveyOpen(true)}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl text-left active:scale-[0.99] transition-all"
          >
            <div>
              <p className="text-[12px] font-extrabold text-blue-700">설문을 완료하면 맞춤 정책을 추천해드려요</p>
              <p className="text-[10px] text-blue-500 font-semibold mt-0.5">나이·지역·관심분야 1분 설정</p>
            </div>
            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {showSkeleton ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm animate-pulse">
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
        ) : error ? (
          <div className="text-center py-10 flex flex-col items-center gap-2">
            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-xs font-bold text-slate-400">정책 목록을 불러올 수 없습니다.</p>
          </div>
        ) : !sortedItems || sortedItems.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center gap-2">
            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs font-bold text-slate-400">조건에 부합하는 정책이 없습니다.</p>
          </div>
        ) : (
          sortedItems!.map((policy) => (
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

      <FloatingFilterButton onClick={() => setIsFilterOpen(true)} />

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
