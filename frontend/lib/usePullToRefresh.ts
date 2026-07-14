"use client";

import { useEffect, useRef, type RefObject } from "react";

interface UsePullToRefreshOptions {
  threshold?: number;
  disabled?: boolean;
}

const DEFAULT_THRESHOLD = 60;

/**
 * 컨테이너 내부 스크롤이 최상단인 상태에서 아래로 당기는 제스처를 감지해
 * 임계값을 넘으면 페이지를 새로고침한다. (overscroll-behavior: none으로 막힌
 * 브라우저 기본 pull-to-refresh를 대체하는 커스텀 구현)
 */
export function usePullToRefresh(
  ref: RefObject<HTMLElement | null>,
  { threshold = DEFAULT_THRESHOLD, disabled = false }: UsePullToRefreshOptions = {}
) {
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);

  useEffect(() => {
    if (disabled) return;
    const container = ref.current;
    if (!container) return;

    // 터치 시작 지점부터 컨테이너까지 조상 중 스크롤 가능한 요소를 찾아,
    // 그 요소가 이미 아래로 스크롤되어 있으면(scrollTop > 0) 당김으로 취급하지 않는다.
    const findScrollable = (target: EventTarget | null): HTMLElement | null => {
      let node = target instanceof HTMLElement ? target : null;
      while (node && node !== container.parentElement) {
        if (node.scrollHeight > node.clientHeight) return node;
        node = node.parentElement;
      }
      return null;
    };

    const handleTouchStart = (e: TouchEvent) => {
      const scrollable = findScrollable(e.target);
      if (scrollable && scrollable.scrollTop > 0) {
        pulling.current = false;
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pulling.current || startY.current === null) return;
      const deltaY = e.touches[0].clientY - startY.current;
      if (deltaY > threshold) {
        pulling.current = false;
        startY.current = null;
        window.location.reload();
      }
    };

    const handleTouchEnd = () => {
      pulling.current = false;
      startY.current = null;
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ref, threshold, disabled]);
}
