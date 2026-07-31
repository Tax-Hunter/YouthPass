"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL;

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");
    const isNewUser = searchParams.get("is_new_user") === "true";

    if (!accessToken || !refreshToken) {
      router.replace("/login");
      return;
    }

    // refresh_token 쿠키는 구글 콜백의 302 리다이렉트 응답에서 바로 심지 않고, 이 페이지가
    // 실제로 로드된 뒤(자동 리다이렉트 체인 밖에서) 별도 fetch로 발급받는다 — iOS Safari ITP가
    // 리다이렉트 체인 중간에 설정된 쿠키를 삭제하는 문제를 피하기 위함.
    (async () => {
      try {
        const res = await fetch(`${BASE}/auth/post/exchange`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) {
          router.replace("/login");
          return;
        }
      } catch {
        router.replace("/login");
        return;
      }

      // access_token은 메모리 상태라 하드 네비게이션 시 어차피 초기화됨 —
      // 다음 페이지의 authStore.initAuth()가 HttpOnly 쿠키로 세션을 복구하므로 여기서 저장하지 않는다.
      // 하드 네비게이션으로 URL의 access_token/refresh_token을 히스토리에서 제거
      window.location.href = isNewUser ? "/survey" : "/home";
    })();
  }, [router, searchParams]);

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-slate-500 text-sm">로그인 처리 중...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <p className="text-slate-500 text-sm">로그인 처리 중...</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
