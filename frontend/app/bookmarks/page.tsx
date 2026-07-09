"use client";

import React from "react";
import { useRouter } from "next/navigation";
import BookmarkedScreen from "@/app/features/bookmarks/BookmarkedScreen";

export default function BookmarkedPage() {
  const router = useRouter();
  return <BookmarkedScreen onNavigate={(screenId) => router.push(`/${screenId}`)} />;
}
