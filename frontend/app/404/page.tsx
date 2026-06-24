"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Error404Screen from "@/app/features/errors/Error404Screen";

export default function Error404Page() {
  const router = useRouter();
  return <Error404Screen onNavigate={(screenId) => router.push(`/${screenId}`)} />;
}
