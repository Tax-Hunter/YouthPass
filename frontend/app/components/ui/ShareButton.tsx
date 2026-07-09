"use client";

import React, { useState } from "react";

interface ShareButtonProps {
  getUrl?: () => string | Promise<string>;
  disabled?: boolean;
  className?: string;
}

const COPIED_DURATION_MS = 1500;

export default function ShareButton({
  getUrl = () => window.location.href,
  disabled = false,
  className = "text-xs font-bold",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const url = await getUrl();
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const el = document.createElement("textarea");
        el.value = url;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_DURATION_MS);
    } catch {
      // 링크 생성 실패 시 조용히 무시 — 복사 상태로 전환하지 않음
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={disabled || loading}
      className={`grid transition-colors ${className} ${
        copied ? "text-emerald-500" : "text-blue-600 hover:underline"
      } ${disabled || loading ? "opacity-40 pointer-events-none" : ""}`}
    >
      <span
        className={`col-start-1 row-start-1 flex items-center gap-1 transition-opacity ${
          copied ? "opacity-100" : "opacity-0 invisible pointer-events-none"
        }`}
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            d="M5 13l4 4L19 7"
          />
        </svg>
        복사됨
      </span>
      <span
        className={`col-start-1 row-start-1 flex items-center gap-1 transition-opacity ${
          !copied && !loading ? "opacity-100" : "opacity-0 invisible pointer-events-none"
        }`}
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          strokeWidth="1.5"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
          />
        </svg>
        공유
      </span>
      <span
        className={`col-start-1 row-start-1 flex items-center gap-1 transition-opacity ${
          loading && !copied ? "opacity-100" : "opacity-0 invisible pointer-events-none"
        }`}
      >
        생성 중...
      </span>
    </button>
  );
}
