"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { tokenStorage } from "@/lib/tokenStorage";

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

    tokenStorage.setTokens(accessToken, refreshToken);
    router.replace(isNewUser ? "/onboarding" : "/home");
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
