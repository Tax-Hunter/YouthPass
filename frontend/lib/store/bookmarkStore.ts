import { create } from "zustand"
import { persist } from "zustand/middleware"

interface BookmarkState {
  bookmarks: string[]
  toggle: (id: string) => void
  isBookmarked: (id: string) => boolean
  clear: () => void
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

      // 로그아웃 시 사용 — 북마크는 계정별 데이터라 다음 로그인 사용자에게 이어지면 안 됨
      clear: () => set({ bookmarks: [] }),
    }),
    {
      name: "youth-pass-bookmarks",
      // v0(레거시 목업 slug id: "rent-support-normal" 등)와 실제 백엔드 plcy_no가 섞여
      // 404를 유발하는 문제가 있어, 버전을 올려 옛 데이터를 폐기한다.
      version: 1,
      migrate: () => ({ bookmarks: [] }),
    }
  )
)
