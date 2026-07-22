"use client";

import { useState } from "react";
import { tokenStorage } from "./tokenStorage";
import { useAuthStore } from "./store/authStore";
import { useBookmarkStore } from "./store/bookmarkStore";
import { useFilterStore } from "./store/filterStore";

interface UseLogoutOptions {
  onSuccess?: () => void;
}

interface UseLogoutResult {
  logout: () => void;
  isLoggingOut: boolean;
}

export function useLogout(options?: UseLogoutOptions): UseLogoutResult {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { clearUser } = useAuthStore();

  const logout = () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    const refreshToken = tokenStorage.getRefreshToken();

    // 토큰 삭제 + 전역 user 상태 즉시 초기화
    tokenStorage.clear();
    clearUser();
    // 북마크·설문 개인화는 계정별 데이터. 다음 로그인 사용자에게 이어지지 않도록 로컬 상태 초기화
    useBookmarkStore.getState().clear();
    useFilterStore.getState().resetForLogout();
    options?.onSuccess?.();

    // 서버 DB에서 refresh token 삭제는 백그라운드 처리
    if (refreshToken) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/post/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {
        tokenStorage.setPendingLogout(refreshToken);
      });
    }
  };

  return { logout, isLoggingOut };
}
