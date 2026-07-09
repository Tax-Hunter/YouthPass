"use client";

import React from "react";
import { useRouter } from "next/navigation";
import HomeScreen from "@/app/features/home/HomeScreen";

export default function HomePage() {
  const router = useRouter();
  return <HomeScreen onNavigate={(screenId) => router.push(`/${screenId}`)} />;
}
