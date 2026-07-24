import { create } from "zustand"

// 라우트 이동으로 화면이 리마운트되어도(예: 상세 페이지 방문 후 뒤로가기) 스크롤 위치를
// 잃지 않도록, 컴포넌트 생명주기와 무관한 별도 스토어에 위치를 기억해둔다. persist는 쓰지 않음 —
// 세션(탭) 안에서만 유지되면 충분하고, 새로고침 시엔 처음부터 보여주는 편이 자연스럽다.
interface ScrollPositionState {
  positions: Record<string, number>
  setScrollPosition: (key: string, value: number) => void
  getScrollPosition: (key: string) => number
}

export const useScrollPositionStore = create<ScrollPositionState>((set, get) => ({
  positions: {},
  setScrollPosition: (key, value) =>
    set((state) => ({ positions: { ...state.positions, [key]: value } })),
  getScrollPosition: (key) => get().positions[key] ?? 0,
}))
