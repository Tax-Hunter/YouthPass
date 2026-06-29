import { create } from "zustand"
import { tokenStorage } from "@/lib/tokenStorage"
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/get/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        set({ user: (await res.json()) as User, isLoading: false })
        return
      }

      if (res.status === 401) {
        const refreshToken = tokenStorage.getRefreshToken()
        if (!refreshToken) {
          tokenStorage.clear()
          set({ user: null, isLoading: false })
          return
        }

        const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/post/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })

        if (!refreshRes.ok) {
          tokenStorage.clear()
          set({ user: null, isLoading: false })
          return
        }

        const { access_token: newAccessToken } = await refreshRes.json()
        tokenStorage.setTokens(newAccessToken, refreshToken)

        const retryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/get/me`, {
          headers: { Authorization: `Bearer ${newAccessToken}` },
        })
        const user = retryRes.ok ? ((await retryRes.json()) as User) : null
        if (!retryRes.ok) tokenStorage.clear()
        set({ user, isLoading: false })
        return
      }

      set({ user: null, isLoading: false })
    } catch {
      set({ user: null, isLoading: false })
    }
  },
}))
