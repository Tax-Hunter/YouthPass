import { create } from "zustand"

interface UiState {
  loginModalOpen: boolean
  openLoginModal: () => void
  closeLoginModal: () => void
  supportModalOpen: boolean
  openSupportModal: () => void
  closeSupportModal: () => void
  notificationModalOpen: boolean
  openNotificationModal: () => void
  closeNotificationModal: () => void
  openInBrowserModalOpen: boolean
  showOpenInBrowserModal: () => void
  closeOpenInBrowserModal: () => void
  searchInputOpen: boolean
  toggleSearchInput: () => void
  closeSearchInput: () => void
  // /search 화면에 새로 진입할 때마다 증가 — SearchScreen의 key로 사용해 강제 리마운트시켜
  // 이전 검색어/결과가 남아있지 않고 항상 초기 상태로 시작하도록 함
  searchVisitId: number
  bumpSearchVisit: () => void
  // 검색/목록 화면의 "마감 정책" 토글 — 상세 화면 이동 후 뒤로가기로 돌아와도
  // 화면이 리마운트되므로, 로컬 useState가 아닌 스토어에 둬서 값을 유지한다
  showClosedOnly: boolean
  toggleShowClosedOnly: () => void
}

export const useUiStore = create<UiState>((set) => ({
  loginModalOpen: false,
  openLoginModal: () => set({ loginModalOpen: true }),
  closeLoginModal: () => set({ loginModalOpen: false }),
  supportModalOpen: false,
  openSupportModal: () => set({ supportModalOpen: true }),
  closeSupportModal: () => set({ supportModalOpen: false }),
  notificationModalOpen: false,
  openNotificationModal: () => set({ notificationModalOpen: true }),
  closeNotificationModal: () => set({ notificationModalOpen: false }),
  openInBrowserModalOpen: false,
  showOpenInBrowserModal: () => set({ openInBrowserModalOpen: true }),
  closeOpenInBrowserModal: () => set({ openInBrowserModalOpen: false }),
  searchInputOpen: false,
  toggleSearchInput: () => set((state) => ({ searchInputOpen: !state.searchInputOpen })),
  closeSearchInput: () => set({ searchInputOpen: false }),
  searchVisitId: 0,
  bumpSearchVisit: () => set((state) => ({ searchVisitId: state.searchVisitId + 1 })),
  showClosedOnly: false,
  toggleShowClosedOnly: () => set((state) => ({ showClosedOnly: !state.showClosedOnly })),
}))
