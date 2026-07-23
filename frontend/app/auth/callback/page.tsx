"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const isNewUser = searchParams.get("is_new_user") === "true";

    if (!accessToken) {
      router.replace("/login");
      return;
    }

    // access_token은 메모리 상태라 하드 네비게이션 시 어차피 초기화됨 —
    // 다음 페이지의 authStore.initAuth()가 HttpOnly 쿠키로 세션을 복구하므로 여기서 저장하지 않는다.
    // 하드 네비게이션으로 URL의 access_token을 히스토리에서 제거
    window.location.href = isNewUser ? "/survey" : "/home";
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
