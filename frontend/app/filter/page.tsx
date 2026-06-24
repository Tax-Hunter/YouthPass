"use client";

import React from "react";
import { useRouter } from "next/navigation";
import FilterScreen from "@/app/features/filter/FilterScreen";

export default function FilterPage() {
  const router = useRouter();
  return <FilterScreen onNavigate={(screenId) => router.push(`/${screenId}`)} />;
}
