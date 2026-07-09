import { create } from "zustand"
import { persist } from "zustand/middleware"

const MAX_RECENT_SEARCHES = 3

interface RecentSearchState {
  recentSearches: string[]
  addRecentSearch: (term: string) => void
  clearRecentSearches: () => void
}

export const useRecentSearchStore = create<RecentSearchState>()(
  persist(
    (set, get) => ({
      recentSearches: [],
      addRecentSearch: (term) => {
        if (get().recentSearches.includes(term)) return
        set((state) => ({
          recentSearches: [term, ...state.recentSearches].slice(0, MAX_RECENT_SEARCHES),
        }))
      },
      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: "youth-pass-recent-searches",
    }
  )
)
