"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FilterScreen from "@/app/features/filter/FilterScreen";

function FilterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "search";
  return (
    <FilterScreen
      onNavigate={(screenId) =>
        router.push(`/${screenId === "search" ? from : screenId}`)
      }
    />
  );
}

export default function FilterPage() {
  return (
    <Suspense>
      <FilterPageInner />
    </Suspense>
  );
}
