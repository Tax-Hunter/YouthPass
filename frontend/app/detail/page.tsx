"use client";

import React from "react";
import { useRouter } from "next/navigation";
import PolicyDetailScreen from "@/app/features/policy/PolicyDetailScreen";

export default function PolicyDetailPage() {
  const router = useRouter();
  return <PolicyDetailScreen onNavigate={(screenId) => router.push(`/${screenId}`)} />;
}
