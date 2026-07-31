import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { BookmarkItem, PolicySource } from "@/lib/types"

interface BookmarkState {
  bookmarks: BookmarkItem[]
  toggle: (plcy_no: string, source?: PolicySource) => void
  isBookmarked: (plcy_no: string, source?: PolicySource) => boolean
  clear: () => void
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      bookmarks: [],

      toggle: (plcy_no, source = "policy") =>
        set((state) => ({
          bookmarks: state.bookmarks.some((b) => b.plcy_no === plcy_no && b.source === source)
            ? state.bookmarks.filter((b) => !(b.plcy_no === plcy_no && b.source === source))
            : [...state.bookmarks, { plcy_no, source }],
        })),

      isBookmarked: (plcy_no, source = "policy") =>
        get().bookmarks.some((b) => b.plcy_no === plcy_no && b.source === source),

      // 로그아웃 시 사용 — 북마크는 계정별 데이터라 다음 로그인 사용자에게 이어지면 안 됨
      clear: () => set({ bookmarks: [] }),
    }),
    {
      name: "youth-pass-bookmarks",
      // v1(source 구분 없이 plcy_no만 저장)은 춘천처럼 자체 DB에 없는 정책의 상세 조회가
      // 항상 실패해 찜 목록에서 조용히 자동 삭제되는 버그가 있었다. source를 추가하며
      // 버전을 올려 옛 데이터를 폐기한다.
      version: 2,
      migrate: () => ({ bookmarks: [] }),
    }
  )
)
