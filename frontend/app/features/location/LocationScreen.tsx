"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface ScreenProps {
  onNavigate?: (screenId: string) => void;
}

const REGIONS = [
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
];

export default function LocationScreen({ onNavigate }: ScreenProps) {
  const router = useRouter();
  const [selectedRegion, setSelectedRegion] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSelect = (region: string) => {
    setSelectedRegion(region);
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 font-sans select-none overflow-hidden relative pt-[76px]">
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col justify-start min-h-[320px]">
        {/* Step Indicator */}
        <div className="flex items-center gap-1 text-sm font-extrabold text-blue-600 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          3
        </div>

        {/* Title Question */}
        <h2 className="text-2xl font-bold text-slate-950 mb-8 leading-normal">
          어디에 거주하시나요?
        </h2>

        {/* Dropdown Select Box */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between px-5 py-4 border border-slate-200 hover:border-blue-500 rounded-2xl text-[15px] font-semibold transition-all bg-white text-left focus:outline-none active:scale-[0.99]"
          >
            <span className={selectedRegion ? "text-slate-900" : "text-slate-400"}>
              {selectedRegion || "시/도 선택"}
            </span>
            <svg 
              className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? "rotate-180 text-blue-600" : ""}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown options popup */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 max-h-56 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-100 z-20 animate-fade-in divide-y divide-slate-50">
              {REGIONS.map((region) => (
                <button
                  key={region}
                  onClick={() => handleSelect(region)}
                  className={`w-full text-left px-5 py-3 text-sm font-semibold hover:bg-blue-50/50 transition-colors ${
                    selectedRegion === region ? "text-blue-600 bg-blue-50/20" : "text-slate-700"
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Next Step Action Button */}
      <footer className="px-6 pb-10 shrink-0">
        <button
          onClick={() => selectedRegion && onNavigate?.("mypage")}
          onMouseEnter={() => {
            router.prefetch("/mypage");
          }}
          disabled={!selectedRegion}
          className={`w-full flex items-center justify-center gap-1.5 py-4 px-4 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.98] ${
            selectedRegion
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 cursor-pointer"
              : "bg-blue-500/50 text-white/70 cursor-not-allowed"
          }`}
        >
          다음
          <svg className="w-4 h-4 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </footer>
    </div>
  );
}
