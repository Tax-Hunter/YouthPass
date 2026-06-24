"use client";

import React from "react";
import { useRouter } from "next/navigation";
import PolicyListV2Screen from "@/app/features/policy/PolicyListV2Screen";

export default function PolicyListV2Page() {
  const router = useRouter();
  return <PolicyListV2Screen onNavigate={(screenId) => router.push(`/${screenId}`)} />;
}
