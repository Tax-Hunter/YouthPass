"use client";

import React from "react";
import { useRouter } from "next/navigation";
import LoginScreen from "@/app/features/auth/LoginScreen";

export default function LoginPage() {
  const router = useRouter();
  return <LoginScreen onNavigate={(screenId) => router.push(`/${screenId}`)} />;
}
