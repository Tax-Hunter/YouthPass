"use client";

import React from "react";
import { useRouter } from "next/navigation";
import MyPageScreen from "@/app/features/mypage/MyPageScreen";

export default function MyPagePage() {
  const router = useRouter();
  return <MyPageScreen onNavigate={(screenId) => router.push(`/${screenId}`)} />;
}
