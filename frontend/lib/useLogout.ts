"use client";

import { useState } from "react";
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

    // 전역 user/토큰 상태 즉시 초기화
    clearUser();
    // 북마크·설문 개인화는 계정별 데이터. 다음 로그인 사용자에게 이어지지 않도록 로컬 상태 초기화
    useBookmarkStore.getState().clear();
    useFilterStore.getState().resetForLogout();
    options?.onSuccess?.();

    // 서버 DB에서 refresh token 삭제 + 쿠키 제거는 백그라운드 처리(쿠키 기반이라 실패해도 재시도 불필요 — 만료로 자연 정리됨)
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/post/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  };

  return { logout, isLoggingOut };
}
