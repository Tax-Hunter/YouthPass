"use client";

import React, { useState, Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Header from "./Header";
import SplashScreen from "./SplashScreen";
import ProfileScreen from "@/app/features/auth/ProfileScreen";
import LoginPromptModal from "@/app/components/ui/LoginPromptModal";
import ComingSoonModal from "@/app/components/ui/ComingSoonModal";
import OpenInBrowserModal from "@/app/components/ui/OpenInBrowserModal";
import { useUiStore } from "@/lib/store/uiStore";
import { useAuthStore } from "@/lib/store/authStore";
import { attemptAutoExitOnEntry } from "@/lib/inAppBrowser";
import { usePullToRefresh } from "@/lib/usePullToRefresh";

const SPLASH_SESSION_KEY = "splash-shown";
const SPLASH_MIN_DURATION = 1500;

// 서버 렌더링에서는 useLayoutEffect가 아무 동작도 하지 않는다는 경고를 피하기 위해
// 브라우저에서만 useLayoutEffect를, 그 외(SSR)에서는 useEffect를 사용한다.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface Props {
  children: React.ReactNode;
}

export default function MobileLayout({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [skipSplash, setSkipSplash] = useState(false);
  const [splashMinTimeElapsed, setSplashMinTimeElapsed] = useState(false);
  const authInitLoading = useAuthStore((s) => s.isLoading);
  const {
    loginModalOpen,
    closeLoginModal,
    supportModalOpen,
    closeSupportModal,
    notificationModalOpen,
    closeNotificationModal,
    openInBrowserModalOpen,
    showOpenInBrowserModal,
    closeOpenInBrowserModal,
    closeSearchInput,
    bumpSearchVisit,
  } = useUiStore();
  const prevPathnameRef = useRef(pathname);
  const contentRef = useRef<HTMLDivElement>(null);
  const { pullDistance, isRefreshing } = usePullToRefresh(contentRef);

  // 사이트 진입(최초 마운트) 시점에 인앱 브라우저 여부를 감지해 외부 브라우저 전환을 시도한다.
  // 로그인 버튼을 누르기 전이라도 카카오톡/Android는 곧바로 Chrome/Safari로 넘어가고,
  // 자동 전환이 불가능한 환경(iOS + 카카오톡 아닌 인앱 브라우저)은 안내 모달을 띄운다.
  useEffect(() => {
    if (attemptAutoExitOnEntry() === "blocked") {
      showOpenInBrowserModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 스플래시 스크린 — 브라우저 세션당 최초 1회만 노출.
  // 이미 표시된 세션이면 브라우저가 화면을 그리기 전(useLayoutEffect)에 감춰
  // 페이드아웃 트랜지션이 눈에 보이지 않도록 한다(풀투리프레시 등 전체 리로드 시 재노출 방지).
  useIsomorphicLayoutEffect(() => {
    if (sessionStorage.getItem(SPLASH_SESSION_KEY)) {
      setSkipSplash(true);
    }
  }, []);

  useEffect(() => {
    if (skipSplash) return;
    const timer = setTimeout(() => setSplashMinTimeElapsed(true), SPLASH_MIN_DURATION);
    return () => clearTimeout(timer);
  }, [skipSplash]);

  // splashVisible은 skipSplash/splashMinTimeElapsed/authInitLoading의 순수 파생값 —
  // 최소 노출 시간과 인증 초기화(initAuth) 완료 시점 중 늦게 끝나는 쪽에 맞춰 자동으로 꺼짐
  const splashVisible = !skipSplash && !(splashMinTimeElapsed && !authInitLoading);

  // 세션 플래그 기록은 상태 파생과 분리된 순수 부수효과라 setState 없이 여기서만 처리
  useEffect(() => {
    if (!skipSplash && splashMinTimeElapsed && !authInitLoading) {
      sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    }
  }, [skipSplash, splashMinTimeElapsed, authInitLoading]);

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
    <div className="min-h-dvh bg-white sm:bg-slate-950 flex items-center justify-center p-0 font-sans select-none relative overflow-hidden overscroll-none">
      <div className="w-full sm:w-[375px] h-dvh overflow-hidden sm:shadow-[0_24px_60px_rgba(0,0,0,0.8)] sm:border sm:border-white/10 relative bg-white flex flex-col overscroll-none">
        <SplashScreen visible={splashVisible} />

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

        {/* 당겨서 새로고침 인디케이터 — Header가 absolute로 떠 있어 콘텐츠는 그 밑으로 흐르므로,
            헤더 바로 아래(top-header)에 절대 위치로 배치해야 실제로 보인다. pullDistance만큼
            높이가 늘어나며 그 안에서 스피너가 회전하고, 새로고침이 예약되면(isRefreshing)
            reload 직전까지 고정 높이로 유지된다. */}
        {showHeader && (pullDistance > 0 || isRefreshing) && (
          <div
            className="absolute inset-x-0 top-header z-10 flex items-center justify-center overflow-hidden pointer-events-none"
            style={{ height: isRefreshing ? 56 : pullDistance }}
          >
            <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        )}

        <div
          ref={contentRef}
          className="flex-1 min-h-0 overflow-hidden relative"
          style={{
            transform: `translateY(${isRefreshing ? 56 : pullDistance}px)`,
            transition: pullDistance === 0 ? "transform 200ms ease-out" : undefined,
          }}
        >
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

        {/* Notification Coming Soon Modal — rendered at phone-frame level (z-[60], above drawer z-50) */}
        {notificationModalOpen && (
          <ComingSoonModal
            onClose={closeNotificationModal}
            title="알림 기능 준비 중이에요"
          />
        )}

        {/* Open In Browser Modal (인앱 브라우저 감지 시 안내) — rendered at phone-frame level (z-[60], above drawer z-50) */}
        {openInBrowserModalOpen && (
          <OpenInBrowserModal onClose={closeOpenInBrowserModal} />
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
