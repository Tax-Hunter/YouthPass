import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { FilterState } from "@/lib/types"

const DEFAULT_FILTERS: FilterState = {
  city: "서울특별시",
  district: "전체",
  employment: "미취업",
  categories: {
    주거: true,
    금융: true,
    일자리: false,
    교육: false,
  },
}

interface FilterStore {
  filters: FilterState
  saveFilters: (newFilters: FilterState) => void
}

export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      filters: DEFAULT_FILTERS,
      saveFilters: (newFilters) => set({ filters: newFilters }),
    }),
    { name: "youth-pass-filters" }
  )
)
