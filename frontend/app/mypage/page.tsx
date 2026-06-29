"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import MyPageScreen from "@/app/features/mypage/MyPageScreen";
import { useAuthStore } from "@/lib/store/authStore";

export default function MyPagePage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/home");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) return null;

  return <MyPageScreen onNavigate={(screenId) => router.push(`/${screenId}`)} />;
}
