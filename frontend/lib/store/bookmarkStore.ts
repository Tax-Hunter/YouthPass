import { create } from "zustand"
import { persist } from "zustand/middleware"

interface BookmarkState {
  bookmarks: string[]
  toggle: (id: string) => void
  isBookmarked: (id: string) => boolean
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      bookmarks: [],

      toggle: (id) =>
        set((state) => ({
          bookmarks: state.bookmarks.includes(id)
            ? state.bookmarks.filter((b) => b !== id)
            : [...state.bookmarks, id],
        })),

      isBookmarked: (id) => get().bookmarks.includes(id),
    }),
    { name: "youth-pass-bookmarks" }
  )
)
