import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { FilterState } from "@/lib/types"

export const DEFAULT_FILTERS: FilterState = {
  city: "전국",
  employment: "",
  categories: {
    주거: false,
    금융: false,
    일자리: false,
    교육: false,
    생활: false,
  },
  keywords: [],
}

interface FilterStore {
  filters: FilterState
  filterApplied: boolean
  // 설문(SurveyScreen) 직후 나이 기반 개인화가 아직 유효한지 — 사용자가 필터 화면에서
  // 직접 적용/초기화하는 순간 꺼져서, 그 뒤로는 사용자가 고른 조건만 반영되게 함
  surveyAgeActive: boolean
  _hasHydrated: boolean
  saveFilters: (newFilters: FilterState) => void
  applySurveyFilters: (newFilters: FilterState) => void
  clearFilters: () => void
  resetForLogout: () => void
  setHasHydrated: (v: boolean) => void
}

export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      filters: DEFAULT_FILTERS,
      filterApplied: false,
      surveyAgeActive: false,
      _hasHydrated: false,
      // FilterScreen에서 사용자가 직접 적용 — 이 시점부터 설문 나이 개인화는 종료되고 사용자가 고른 조건만 반영
      saveFilters: (newFilters) => set({ filters: newFilters, filterApplied: true, surveyAgeActive: false }),
      // SurveyScreen 완료 직후에만 사용 — 나이 기반 개인화를 활성화
      applySurveyFilters: (newFilters) => set({ filters: newFilters, filterApplied: true, surveyAgeActive: true }),
      // age·educationLevel은 설문(SurveyScreen) 응답 값이라 필터 초기화 대상에서 제외 — 그대로 유지
      clearFilters: () => set((state) => ({
        filters: {
          ...DEFAULT_FILTERS,
          age: state.filters.age,
          educationLevel: state.filters.educationLevel,
        },
        filterApplied: false,
        surveyAgeActive: false,
      })),
      // 로그아웃 시 사용 — clearFilters와 달리 설문 응답(age·educationLevel)까지 완전히 제거해
      // 다음 로그인 사용자에게 이전 사용자의 개인화가 이어지지 않게 함
      resetForLogout: () => set({ filters: DEFAULT_FILTERS, filterApplied: false, surveyAgeActive: false }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: "youth-pass-filters",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FilterStore>
        return {
          ...current,
          filters: { ...DEFAULT_FILTERS, ...p.filters },
          filterApplied: p.filterApplied ?? false,
          surveyAgeActive: p.surveyAgeActive ?? false,
        }
      },
    }
  )
)
