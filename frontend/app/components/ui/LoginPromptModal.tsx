"use client";

import React from "react";

interface LoginPromptModalProps {
  onClose: () => void;
}

export default function LoginPromptModal({ onClose }: LoginPromptModalProps) {
  const handleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/get/google-login?redirect_origin=${encodeURIComponent(window.location.origin)}`;
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Modal Card */}
      <div className="relative w-full sm:mx-6 bg-white rounded-t-3xl sm:rounded-3xl px-6 pt-8 pb-10 shadow-2xl animate-slide-up">
        {/* Lock Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="text-center mb-7 space-y-2">
          <h3 className="text-[17px] font-bold text-slate-900 leading-snug">
            로그인이 필요한 기능이에요
          </h3>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Google 계정으로 간편하게 로그인하고<br />
            나에게 맞는 청년 혜택을 받아보세요
          </p>
        </div>

        {/* Google Login Button */}
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[13px] font-bold shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.513 0-6.38-2.87-6.38-6.38A6.378 6.378 0 0 1 14 5.75c1.459 0 2.64.5 3.559 1.341l3.181-3.18C18.822 2.1 15.64 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c5.899 0 10.985-4.103 10.985-11.24 0-.693-.06-1.342-.186-1.955H12.24z" />
          </svg>
          Google 계정으로 시작하기
        </button>

        {/* Cancel Button */}
        <button
          onClick={onClose}
          className="w-full mt-3 py-3 text-[13px] font-bold text-slate-400 hover:text-slate-600 transition-colors active:scale-[0.98]"
        >
          취소
        </button>
      </div>
    </div>
  );
}
