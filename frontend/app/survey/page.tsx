"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import SurveyScreen from "@/app/features/auth/SurveyScreen";
import { useAuthStore } from "@/lib/store/authStore";

export default function SurveyPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/home");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) return null;

  return <SurveyScreen />;
}
