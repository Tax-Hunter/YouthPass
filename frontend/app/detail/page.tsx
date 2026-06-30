"use client";

import React, { Suspense } from "react";
import { useRouter } from "next/navigation";
import PolicyDetailScreen from "@/app/features/policy/PolicyDetailScreen";

export default function PolicyDetailPage() {
  const router = useRouter();
  return (
    <Suspense>
      <PolicyDetailScreen onNavigate={(screenId) => router.push(`/${screenId}`)} />
    </Suspense>
  );
}
