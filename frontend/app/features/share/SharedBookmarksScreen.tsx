"use client";

import React, { useEffect } from "react";
import { useSharedPolicies } from "@/lib/api/share";
import PolicyCard from "@/app/components/ui/PolicyCard";
import ScreenContent, { ScreenBleed } from "@/app/components/layout/ScreenContent";
import type { PolicySource } from "@/lib/types";

interface ScreenProps {
  code: string;
  onNavigate?: (screenId: string) => void;
}

export default function SharedBookmarksScreen({ code, onNavigate }: ScreenProps) {
  const { data, error, isLoading } = useSharedPolicies(code);

  // 만료/미존재 공유 코드는 404로 이동
  useEffect(() => {
    if (error) onNavigate?.("404");
  }, [error, onNavigate]);

  const handleCardClick = (plcy_no: string, source: PolicySource) => {
    onNavigate?.(`detail?id=${plcy_no}&src=${source}`);
  };

  return (
    <ScreenContent className="h-full flex flex-col bg-white text-slate-800 font-sans select-none">
      <div className="pt-5 pb-3 shrink-0">
        <h2 className="text-[16px] font-bold text-slate-900">공유 목록</h2>
      </div>

      <ScreenBleed className="border-t border-slate-50" />

      <div className="flex-1 py-5 space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-5 bg-white border border-slate-100 rounded-2xl animate-pulse">
              <div className="flex justify-between mb-3">
                <div className="h-5 w-14 bg-slate-200 rounded-full" />
                <div className="h-5 w-10 bg-slate-200 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 rounded-md w-11/12" />
                <div className="h-3 bg-slate-200 rounded-md w-7/12" />
              </div>
            </div>
          ))
        ) : !data || data.items.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-2">
            <p className="text-xs font-bold text-slate-400">
              공유된 정책이 없습니다.
            </p>
          </div>
        ) : (
          data.items.map((policy) => (
            <PolicyCard
              key={`${policy.source ?? "policy"}:${policy.plcy_no}`}
              policy={policy}
              source={policy.source ?? "policy"}
              isBookmarked={false}
              onToggleBookmark={() => {}}
              onClick={() => handleCardClick(policy.plcy_no, policy.source ?? "policy")}
              showCategory={true}
              showLocation={true}
              showActionText={false}
              showBookmark={false}
            />
          ))
        )}
      </div>
    </ScreenContent>
  );
}
