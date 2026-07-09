"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import LocationScreen from "@/app/features/location/LocationScreen";
import { useAuthStore } from "@/lib/store/authStore";

export default function LocationPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/home");
    } else if (!user.survey_completed) {
      router.replace("/survey");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user || !user.survey_completed) return null;

  return <LocationScreen onNavigate={(screenId) => router.push(`/${screenId}`)} />;
}
