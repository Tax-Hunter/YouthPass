"use client";

import React from "react";

interface ComingSoonModalProps {
  onClose: () => void;
  title?: string;
  description?: React.ReactNode;
}

export default function ComingSoonModal({
  onClose,
  title = "고객센터 준비 중이에요",
  description = (
    <>
      더 나은 서비스 제공을 위해
      <br />
      열심히 준비하고 있어요
    </>
  ),
}: ComingSoonModalProps) {
  return (
    <div className="absolute inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Modal Card */}
      <div className="relative w-full sm:mx-6 bg-white rounded-t-3xl sm:rounded-3xl px-6 pt-8 pb-10 shadow-2xl animate-slide-up">
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="text-center mb-7 space-y-2">
          <h3 className="text-[17px] font-bold text-slate-900 leading-snug">
            {title}
          </h3>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            {description}
          </p>
        </div>

        {/* Confirm Button */}
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center py-3.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-[13px] font-bold active:scale-[0.98] transition-all"
        >
          확인
        </button>
      </div>
    </div>
  );
}
