"use client";

import React from "react";
import { useRouter } from "next/navigation";
import LocationScreen from "@/app/features/location/LocationScreen";

export default function LocationPage() {
  const router = useRouter();
  return <LocationScreen onNavigate={(screenId) => router.push(`/${screenId}`)} />;
}
