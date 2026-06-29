"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  onNavigate?: (screenId: string) => void;
  isLocationHeader?: boolean;
  currentScreen?: string;
  onProfileClick?: () => void;
  pathname?: string;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
}

export default function Header({
  onNavigate,
  isLocationHeader = false,
  currentScreen,
  onProfileClick,
  pathname,
  onBack,
  onSkip,
  skipLabel = "나중에 하기",
}: Props) {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let lastScrollTop = 0;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target || typeof target.scrollTop === "undefined") return;

      const currentScrollTop = target.scrollTop;

      if (currentScrollTop <= 10) {
        setIsScrolled(false);
      } else {
        if (currentScrollTop < lastScrollTop) {
          setIsScrolled(false);
        } else if (currentScrollTop > lastScrollTop) {
          setIsScrolled(true);
        }
      }
      lastScrollTop = currentScrollTop;
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      setIsScrolled(false);
    };
  }, [pathname]);

  // Center Brand Logo (Clickable to go home)
  const centerLogo = (
    <button
      onClick={() => {
        if (onNavigate) {
          onNavigate("home");
        } else {
          router.push("/home");
        }
      }}
      onMouseEnter={() => {
        router.prefetch("/home");
      }}
      className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center hover:opacity-85 active:scale-95 transition-all duration-300 cursor-pointer z-20 shrink-0 ${
        isScrolled ? "top-[48%]" : "top-[53%]"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo.png"
        alt="청년패스 로고"
        style={{ width: "auto", height: isScrolled ? "2.25rem" : "3.75rem", transition: "height 0.3s" }}
        className="object-contain rounded-md"
      />
    </button>
  );

  const headerBgClass = isScrolled
    ? "bg-white border-b border-slate-100 shadow-xs"
    : "bg-white border-b border-slate-100";

  const buttonOpacityClass = isScrolled ? "opacity-0 pointer-events-none" : "opacity-100";

  if (isLocationHeader) {
    return (
      <header className={`w-full flex items-center justify-between px-5 absolute top-0 left-0 right-0 z-30 shrink-0 box-border select-none transition-all duration-300 ${isScrolled ? "h-13.5 pt-1" : "h-19 pt-3"} ${headerBgClass}`}>
        {/* Left Back Arrow & Text */}
        <button
          onClick={() => onBack ? onBack() : router.back()}
          className={`flex items-center text-sm font-bold text-blue-600 hover:text-blue-700 transition-all duration-300 p-1 active:scale-95 shrink-0 ${buttonOpacityClass}`}
        >
          <svg className="w-5 h-5 mr-0.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          이전
        </button>

        {/* Center Brand Logo */}
        {centerLogo}

        {/* Right Action */}
        <button
          onClick={() => onSkip ? onSkip() : router.push("/home")}
          className={`text-xs font-bold text-slate-400 hover:text-slate-700 transition-all duration-300 p-1 active:scale-95 shrink-0 ${buttonOpacityClass}`}
        >
          {skipLabel}
        </button>
      </header>
    );
  }

  // Hide right search/profile actions on login page
  const showRightActions = pathname !== "/login";

  return (
    <header className={`w-full flex items-center justify-between px-5 absolute top-0 left-0 right-0 z-30 shrink-0 box-border select-none transition-all duration-300 ${isScrolled ? "h-13.5 pt-1" : "h-19 pt-3"} ${headerBgClass}`}>
      {/* Left Back Button */}
      <button
        onClick={() => {
          router.back();
        }}
        className={`p-1.5 hover:bg-slate-100 active:scale-90 rounded-full transition-all duration-300 text-slate-700 flex items-center justify-center shrink-0 ${buttonOpacityClass}`}
      >
        <svg className="w-6 h-6 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Center Brand Logo */}
      {centerLogo}

      {/* Right Icons */}
      <div className={`flex items-center gap-3 shrink-0 transition-all duration-300 ${buttonOpacityClass}`}>
        {showRightActions && (
          <>
            <button
              onClick={() => onNavigate?.("search")}
              onMouseEnter={() => {
                router.prefetch("/search");
              }}
              className={`p-1.5 hover:bg-slate-100 active:scale-90 rounded-full transition-all flex items-center justify-center ${currentScreen === "search" ? "text-blue-600" : "text-slate-700"
                }`}
            >
              <svg className="w-6 h-6 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              onClick={onProfileClick}
              className={`p-1.5 hover:bg-slate-100 active:scale-90 rounded-full transition-all flex items-center justify-center ${currentScreen === "profile" ? "text-blue-600" : "text-slate-700"
                }`}
            >
              <svg className="w-6 h-6 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </>
        )}
      </div>
    </header>
  );
}

