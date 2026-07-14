"use client";

import React, { useState, Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Header from "./Header";
import ProfileScreen from "@/app/features/auth/ProfileScreen";
import LoginPromptModal from "@/app/components/ui/LoginPromptModal";
import ComingSoonModal from "@/app/components/ui/ComingSoonModal";
import { useUiStore } from "@/lib/store/uiStore";

interface Props {
  children: React.ReactNode;
}

export default function MobileLayout({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const { loginModalOpen, closeLoginModal, supportModalOpen, closeSupportModal, closeSearchInput, bumpSearchVisit } = useUiStore();
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== "/search") {
      closeSearchInput();
    } else if (prevPathnameRef.current !== "/search") {
      // 다른 화면에서 /search로 (재)진입한 시점 — 검색 화면을 항상 초기 상태로 리마운트
      bumpSearchVisit();
    }
    prevPathnameRef.current = pathname;
  }, [pathname, closeSearchInput, bumpSearchVisit]);

  // Prefetch other static pages for smoother transitions
  useEffect(() => {
    const routes = [
      "/",
      "/home",
      "/list",
      "/detail",
      "/mypage",
      "/bookmarks",
      "/search",
      "/location",
      "/survey",
      "/filter",
      "/login",
      "/skeleton"
    ];
    routes.forEach((route) => {
      if (route !== pathname) {
        router.prefetch(route);
      }
    });
  }, [router, pathname]);

  // Define route configurations for the unified header
  let showHeader = true;
  let isLocationHeader = false;
  let currentScreen: string | undefined = undefined;

  if (pathname === "/filter" || pathname === "/survey") {
    showHeader = false;
  } else if (pathname === "/location") {
    isLocationHeader = true;
  } else if (pathname === "/search") {
    currentScreen = "search";
  }

  const handleNavigate = (screenId: string) => {
    router.push(`/${screenId}`);
  };

  return (
    <div className="min-h-dvh bg-white sm:bg-slate-950 flex items-center justify-center p-0 sm:p-4 font-sans select-none relative overflow-hidden overscroll-none">
      <div className="w-full sm:w-[375px] h-dvh sm:h-[812px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.8)] border border-slate-900 sm:border-white/10 relative bg-white flex flex-col overscroll-none">
        {/* Unified sticky header componentized and used only once */}
        {showHeader && (
          <Suspense fallback={<div className="w-full h-[76px] bg-white border-b border-slate-100 shrink-0" />}>
            <Header
              onNavigate={handleNavigate}
              isLocationHeader={isLocationHeader}
              currentScreen={currentScreen}
              onProfileClick={() => setIsProfileOpen(true)}
              pathname={pathname}
              onScrolledChange={setIsHeaderScrolled}
            />
          </Suspense>
        )}

        {/* 헤더 바로 아래에서 스크롤 콘텐츠가 딱 잘려 보이는 걸 부드럽게 가려주는 블러 페이드
            — 헤더가 스크롤로 줄어든 상태(isHeaderScrolled)일 때만 노출.
            헤더가 줄어드는 높이(top-header-min)를 기준으로 잡고, 줄어들기 전 남는 차이만큼
            높이를 더 줘서 헤더 뒤에 가려지게 함 (shrink 애니메이션 중에도 안 밀리게) */}
        {showHeader && (
          <div
            className={`absolute inset-x-0 top-header-min z-20 h-12 pointer-events-none backdrop-blur-md transition-opacity duration-100 ${
              isHeaderScrolled ? "opacity-100" : "opacity-0"
            }`}
            style={{
              maskImage: "linear-gradient(to bottom, black, transparent)",
              WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
            }}
          />
        )}

        <div className="flex-1 min-h-0 overflow-hidden relative">
          {children}
        </div>

        {/* Login Prompt Modal — rendered at phone-frame level (z-[60], above drawer z-50) */}
        {loginModalOpen && (
          <LoginPromptModal onClose={closeLoginModal} />
        )}

        {/* Coming Soon Modal — rendered at phone-frame level (z-[60], above drawer z-50) */}
        {supportModalOpen && (
          <ComingSoonModal onClose={closeSupportModal} />
        )}

        {/* Profile Menu Popup Drawer inside the phone frame (routing-free) */}
        {isProfileOpen && (
          <div className="absolute inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
              onClick={() => setIsProfileOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in cursor-pointer"
            />
            {/* Drawer */}
            <div className="relative w-[300px] h-full bg-white shadow-2xl flex flex-col animate-slide-left z-10 border-l border-slate-100">
              {/* Close row inside drawer */}
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-white shrink-0">
                <span className="text-sm font-bold text-slate-800">전체 메뉴</span>
                <button
                  onClick={() => setIsProfileOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 active:scale-95 text-slate-400 hover:text-slate-700 transition-all font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Drawer Content Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <ProfileScreen
                  onClose={() => setIsProfileOpen(false)}
                  onNavigate={(target: string) => {
                    setIsProfileOpen(false);
                    router.push(`/${target}`);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
