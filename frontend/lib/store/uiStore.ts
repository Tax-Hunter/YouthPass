import { create } from "zustand"

interface UiState {
  loginModalOpen: boolean
  openLoginModal: () => void
  closeLoginModal: () => void
  supportModalOpen: boolean
  openSupportModal: () => void
  closeSupportModal: () => void
  searchInputOpen: boolean
  toggleSearchInput: () => void
  closeSearchInput: () => void
}

export const useUiStore = create<UiState>((set) => ({
  loginModalOpen: false,
  openLoginModal: () => set({ loginModalOpen: true }),
  closeLoginModal: () => set({ loginModalOpen: false }),
  supportModalOpen: false,
  openSupportModal: () => set({ supportModalOpen: true }),
  closeSupportModal: () => set({ supportModalOpen: false }),
  searchInputOpen: false,
  toggleSearchInput: () => set((state) => ({ searchInputOpen: !state.searchInputOpen })),
  closeSearchInput: () => set({ searchInputOpen: false }),
}))
