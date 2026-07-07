"use client";

import React, { useState } from "react";
import { useFilterStore } from "@/lib/store/filterStore";
import { CITY_OPTIONS } from "@/lib/sidoMap";
import SelectDropdown from "@/app/components/ui/SelectDropdown";
import OptionButton from "@/app/components/ui/OptionButton";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

export default function FilterScreen({ onNavigate }: ScreenProps) {
  const { filters, saveFilters, clearFilters } = useFilterStore();

  const [city, setCity] = useState(() => filters.city);
  const [employment, setEmployment] = useState(() => filters.employment);
  const [categories, setCategories] = useState<Record<string, boolean>>(
    () => filters.categories,
  );

  const toggleCategory = (cat: string) => {
    setCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const resetFilters = () => {
    setCity("전국");
    setEmployment("미취업");
    setCategories({
      주거: false,
      금융: false,
      일자리: false,
      교육: false,
    });
    clearFilters();
  };

  const applyFilters = () => {
    const isNeutral =
      city === "전국" &&
      employment === "미취업" &&
      !Object.values(categories).some(Boolean);

    if (isNeutral) {
      // 선택된 항목이 하나도 없으면 "적용"이 아니라 초기화와 동일하게 처리 — 필터 버튼이 검정으로 유지됨
      clearFilters();
    } else {
      saveFilters({
        ...filters,
        city,
        employment,
        categories,
      });
    }
    onNavigate?.("search");
  };

  return (
    <div className="flex flex-col h-full text-slate-800 font-sans select-none relative justify-end">
      {/* Dim overlay — 뒤 페이지가 그대로 보임 */}
      <div
        onClick={() => onNavigate?.("search")}
        className="absolute inset-0 bg-black/40 z-10 cursor-pointer"
      />

      {/* Bottom Sheet Drawer */}
      <div className="relative bg-white rounded-t-4xl shadow-2xl z-20 flex flex-col max-h-[90%] animate-slide-up border-t border-slate-100 shrink-0">
        {/* Handle */}
        <div className="w-full flex justify-center py-3 shrink-0">
          <div className="w-12 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <header className="flex items-center justify-between px-screen pb-4 border-b border-slate-50 shrink-0">
          <h3 className="text-[17px] font-bold text-slate-900">필터</h3>
          <button
            onClick={() => onNavigate?.("search")}
            className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        {/* Scrolling Fields + sticky footer */}
        <div className="flex-1 overflow-y-auto scroll-stable">
          <div className="px-screen py-5 space-y-6 pb-0">
            {/* Section 1: 거주 지역 */}
            <div className="space-y-2.5">
              <h4 className="text-[13px] font-bold text-slate-800">
                거주 지역
              </h4>
              <SelectDropdown value={city} onChange={setCity} options={CITY_OPTIONS} />
            </div>

            {/* Section 2: 취업 상태 */}
            <div className="space-y-2.5">
              <h4 className="text-[13px] font-bold text-slate-800">
                취업 상태
              </h4>
              <div className="grid grid-cols-3 gap-2.5">
                {["미취업", "재직", "프리랜서", "재학"].map((status) => (
                  <OptionButton
                    key={status}
                    label={status}
                    isActive={employment === status}
                    onClick={() => setEmployment(status)}
                    className="py-3 px-2"
                  />
                ))}
              </div>
            </div>

            {/* Section 3: 관심 카테고리 */}
            <div className="space-y-2.5">
              <h4 className="text-[13px] font-bold text-slate-800">
                관심 카테고리 (다중)
              </h4>
              <div className="flex flex-wrap gap-2.5">
                {["주거", "금융", "일자리", "교육"].map((cat) => (
                  <OptionButton
                    key={cat}
                    label={cat}
                    isActive={categories[cat]}
                    onClick={() => toggleCategory(cat)}
                    showCheckmark={true}
                    className="py-3 px-4"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer - sticky inside scroll */}
          <footer className="sticky bottom-0 p-5 border-t border-slate-100 flex items-center gap-3 bg-white pb-safe-xl z-10">
            <button
              onClick={resetFilters}
              className="py-4.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-colors active:scale-95 text-[14.5px] shrink-0"
              title="초기화"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              초기화
            </button>

            <button
              onClick={applyFilters}
              className="flex-1 py-4.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-[14.5px] shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98]"
            >
              적용하기
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
