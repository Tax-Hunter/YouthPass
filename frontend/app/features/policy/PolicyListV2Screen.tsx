"use client";

import React from "react";
import { useRouter } from "next/navigation";
import FloatingFilterButton from "@/app/components/ui/FloatingFilterButton";
import Badge from "@/app/components/ui/Badge";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function PolicyListV2Screen({ onNavigate }: ScreenProps) {
  const router = useRouter();
  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 font-sans select-none overflow-hidden relative">
      {/* Main Skeleton List */}
      <div className="flex-1 overflow-y-auto scroll-stable px-5 pb-24 pt-[96px] space-y-4 animate-pulse">
        {/* Card 1: Housing */}
        <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Badge variant="neutral" size="md">
              주거
            </Badge>
            <Badge variant="danger" size="md">
              D-3
            </Badge>
          </div>
          {/* Skeleton lines */}
          <div className="space-y-2.5">
            <div className="h-4 bg-slate-200 rounded-md w-11/12" />
            <div className="h-3 bg-slate-200 rounded-md w-7/12" />
          </div>
        </div>

        {/* Card 2: Finance */}
        <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Badge variant="neutral" size="md">
              금융
            </Badge>
            <Badge variant="primary" size="md">
              예정
            </Badge>
          </div>
          {/* Skeleton lines */}
          <div className="space-y-2.5">
            <div className="h-4 bg-slate-200 rounded-md w-11/12" />
            <div className="h-3 bg-slate-200 rounded-md w-7/12" />
          </div>
        </div>

        {/* Card 3: Job */}
        <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Badge variant="neutral" size="md">
              일자리
            </Badge>
            <Badge variant="neutral" size="md">
              마감
            </Badge>
          </div>
          {/* Skeleton lines */}
          <div className="space-y-2.5">
            <div className="h-4 bg-slate-200 rounded-md w-11/12" />
            <div className="h-3 bg-slate-200 rounded-md w-5/12" />
          </div>
        </div>
      </div>

      {/* Floating Bottom Button for Filters */}
      <FloatingFilterButton 
        onClick={() => onNavigate?.("filter")}
        onMouseEnter={() => {
          router.prefetch("/filter");
        }}
      />
    </div>
  );
}
