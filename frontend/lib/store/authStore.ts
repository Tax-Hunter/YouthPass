import { create } from "zustand";
import { tokenStorage } from "@/lib/tokenStorage";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import type { User } from "@/lib/types";
import { useFilterStore, DEFAULT_FILTERS } from "@/lib/store/filterStore";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user }),

  clearUser: () => set({ user: null, isLoading: false }),

  initAuth: async () => {
    const pendingToken = tokenStorage.getPendingLogout();
    if (pendingToken) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/post/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: pendingToken }),
      })
        .then(() => tokenStorage.clearPendingLogout())
        .catch(() => {});
    }

    const token = tokenStorage.getAccessToken();
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      const res = await fetchWithAuth(
        `${process.env.NEXT_PUBLIC_API_URL}/users/get/me`,
      );
      if (!res.ok) {
        tokenStorage.clear();
        set({ user: null, isLoading: false });
        return;
      }
      const user = (await res.json()) as User;
      set({ user, isLoading: false });

      // 로그아웃 시 로컬 개인화(filterStore)를 지우므로, 같은 계정으로 다시 로그인했을 때
      // 계정에 저장된 설문 결과로 복원. 이미 로컬에 값이 있으면(직접 필터링 등) 덮어쓰지 않음
      const { filters, applySurveyFilters } = useFilterStore.getState();
      if (user.survey_completed && user.age != null && filters.age == null) {
        applySurveyFilters({
          ...filters,
          age: user.age,
          city: user.region_city ?? filters.city,
          categories: Object.fromEntries(
            Object.keys(DEFAULT_FILTERS.categories).map((k) => [
              k,
              (user.interests ?? []).includes(k),
            ]),
          ),
        });
      }
    } catch {
      set({ user: null, isLoading: false });
    }
  },
}));
