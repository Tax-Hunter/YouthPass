"use client";

import React from "react";
import { useRouter } from "next/navigation";
import SearchScreen from "@/app/features/search/SearchScreen";

export default function SearchPage() {
  const router = useRouter();
  return <SearchScreen onNavigate={(screenId) => router.push(`/${screenId}`)} />;
}
