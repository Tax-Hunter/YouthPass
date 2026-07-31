import { create } from "zustand";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import type { User } from "@/lib/types";
import { useFilterStore, DEFAULT_FILTERS } from "@/lib/store/filterStore";

const BASE = process.env.NEXT_PUBLIC_API_URL;

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  setAccessToken: (accessToken: string | null) => void;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,

  setUser: (user) => set({ user }),

  clearUser: () => set({ user: null, accessToken: null, isLoading: false }),

  setAccessToken: (accessToken) => set({ accessToken }),

  initAuth: async () => {
    // 구버전(localStorage 기반 토큰 저장) 코드로 로그인했던 사용자의 잔존 값 정리.
    // 신버전은 이 키들을 더 이상 읽거나 쓰지 않으므로 존재 여부만 보고 무조건 삭제.
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    // refresh_token은 HttpOnly 쿠키로만 존재하므로, 부팅 시 항상 쿠키 기반으로 access token을 재발급받아 세션을 복구
    try {
      const refreshRes = await fetch(`${BASE}/auth/post/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!refreshRes.ok) {
        set({ user: null, accessToken: null, isLoading: false });
        return;
      }
      const { access_token } = await refreshRes.json();
      set({ accessToken: access_token });

      const res = await fetchWithAuth(`${BASE}/users/get/me`);
      if (!res.ok) {
        set({ user: null, accessToken: null, isLoading: false });
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
      set({ user: null, accessToken: null, isLoading: false });
    }
  },
}));
