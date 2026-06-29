"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FilterScreen from "@/app/features/filter/FilterScreen";

function FilterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "list";
  return (
    <FilterScreen
      onNavigate={(screenId) =>
        router.push(`/${screenId === "list" ? from : screenId}`)
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
