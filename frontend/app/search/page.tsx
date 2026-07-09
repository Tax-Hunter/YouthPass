"use client";

import React from "react";
import { useRouter } from "next/navigation";
import SearchScreen from "@/app/features/search/SearchScreen";
import { useUiStore } from "@/lib/store/uiStore";

export default function SearchPage() {
  const router = useRouter();
  const searchVisitId = useUiStore((s) => s.searchVisitId);
  return (
    <SearchScreen
      key={searchVisitId}
      onNavigate={(screenId) => router.push(`/${screenId}`)}
    />
  );
}
