"use client";

import React, { useState } from "react";
import { isAndroid, getAndroidChromeIntentUrl } from "@/lib/inAppBrowser";

interface OpenInBrowserModalProps {
  onClose: () => void;
}

export default function OpenInBrowserModal({ onClose }: OpenInBrowserModalProps) {
  const [copied, setCopied] = useState(false);

  const handleOpenChrome = () => {
    window.location.href = getAndroidChromeIntentUrl(window.location.href);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
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
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="text-center mb-7 space-y-2">
          <h3 className="text-[17px] font-bold text-slate-900 leading-snug">
            외부 브라우저에서 열어주세요
          </h3>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            카카오톡, 인스타그램 등 앱 내 브라우저에서는<br />
            Google 보안 정책으로 로그인할 수 없어요.<br />
            Chrome, Safari 등에서 다시 열어주세요.
          </p>
        </div>

        {/* Primary Action */}
        {isAndroid() ? (
          <button
            onClick={handleOpenChrome}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[13px] font-bold shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all"
          >
            Chrome으로 열기
          </button>
        ) : (
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[13px] font-bold shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all"
          >
            {copied ? "링크가 복사되었어요" : "링크 복사하기"}
          </button>
        )}
        {isAndroid() && (
          <p className="mt-3 text-center text-[11px] text-slate-400 font-medium">
            안 열리면 우측 상단 메뉴에서 &apos;다른 브라우저로 열기&apos;를 눌러주세요
          </p>
        )}
        {!isAndroid() && (
          <p className="mt-3 text-center text-[11px] text-slate-400 font-medium">
            복사한 링크를 Safari(또는 Chrome) 주소창에 붙여넣어 접속해주세요
          </p>
        )}

        {/* Cancel Button */}
        <button
          onClick={onClose}
          className="w-full mt-3 py-3 text-[13px] font-bold text-slate-400 hover:text-slate-600 transition-colors active:scale-[0.98]"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
