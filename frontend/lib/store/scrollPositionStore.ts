import { create } from "zustand"

interface ScrollPositionState {
  positions: Record<string, number>
  setScrollPosition: (key: string, value: number) => void
  getScrollPosition: (key: string) => number | undefined
}

// persist 미적용 — 탭이 유지되는 동안(리마운트/뒤로가기)만 스크롤 위치를 기억하면 되므로
// localStorage 영속화는 불필요
export const useScrollPositionStore = create<ScrollPositionState>((set, get) => ({
  positions: {},
  setScrollPosition: (key, value) =>
    set((state) => ({ positions: { ...state.positions, [key]: value } })),
  getScrollPosition: (key) => get().positions[key],
}))
