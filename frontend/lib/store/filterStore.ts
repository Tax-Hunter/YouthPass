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
  _hasHydrated: boolean
  saveFilters: (newFilters: FilterState) => void
  clearFilters: () => void
  setHasHydrated: (v: boolean) => void
}

export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      filters: DEFAULT_FILTERS,
      filterApplied: false,
      _hasHydrated: false,
      saveFilters: (newFilters) => set({ filters: newFilters, filterApplied: true }),
      // age는 설문(SurveyScreen) 응답 값이라 필터 초기화 대상에서 제외 — 그대로 유지
      clearFilters: () => set((state) => ({
        filters: { ...DEFAULT_FILTERS, age: state.filters.age },
        filterApplied: false,
      })),
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
        }
      },
    }
  )
)
