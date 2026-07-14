"use client";

import React, { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import SharedBookmarksScreen from "@/app/features/share/SharedBookmarksScreen";

export default function SharedBookmarksPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;

  return (
    <Suspense>
      <SharedBookmarksScreen
        code={code}
        onNavigate={(screenId) => router.push(`/${screenId}`)}
      />
    </Suspense>
  );
}
