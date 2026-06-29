import { create } from "zustand"
import { tokenStorage } from "@/lib/tokenStorage"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import type { User } from "@/lib/types"

interface AuthState {
  user: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
  clearUser: () => void
  initAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user }),

  clearUser: () => set({ user: null, isLoading: false }),

  initAuth: async () => {
    const pendingToken = tokenStorage.getPendingLogout()
    if (pendingToken) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/post/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: pendingToken }),
      })
        .then(() => tokenStorage.clearPendingLogout())
        .catch(() => {})
    }

    const token = tokenStorage.getAccessToken()
    if (!token) {
      set({ isLoading: false })
      return
    }

    try {
      const res = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/users/get/me`)
      if (res.ok) {
        set({ user: (await res.json()) as User, isLoading: false })
      } else {
        if (res.status === 401) tokenStorage.clear()
        set({ user: null, isLoading: false })
      }
    } catch {
      set({ user: null, isLoading: false })
    }
  },
}))
