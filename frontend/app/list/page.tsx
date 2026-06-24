"use client";

import React from "react";
import { useRouter } from "next/navigation";
import PolicyListScreen from "@/app/features/policy/PolicyListScreen";

export default function PolicyListPage() {
  const router = useRouter();
  return <PolicyListScreen onNavigate={(screenId) => router.push(`/${screenId}`)} />;
}
