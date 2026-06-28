"use client";

import React, { useState, Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Header from "./Header";
import ProfileScreen from "@/app/features/auth/ProfileScreen";
import { useAuth } from "@/lib/AuthContext";

interface Props {
  children: React.ReactNode;
}

export default function MobileLayout({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, isLoading: isUserLoading } = useAuth();

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

  if (pathname === "/filter") {
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-0 sm:p-4 font-sans select-none relative overflow-hidden">
      <div className="w-full sm:w-[375px] h-screen sm:h-[812px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.8)] border border-slate-900 sm:border-white/10 relative bg-white flex flex-col">
        {/* Unified sticky header componentized and used only once */}
        {showHeader && (
          <Suspense fallback={<div className="w-full h-[76px] bg-white border-b border-slate-100 shrink-0" />}>
            <Header
              onNavigate={handleNavigate}
              isLocationHeader={isLocationHeader}
              currentScreen={currentScreen}
              onProfileClick={() => setIsProfileOpen(true)}
              pathname={pathname}
            />
          </Suspense>
        )}

        <div className="flex-1 min-h-0 overflow-hidden relative">
          {children}
        </div>

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
                  user={user}
                  isLoading={isUserLoading}
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
