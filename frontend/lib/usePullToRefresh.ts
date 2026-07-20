"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

interface UsePullToRefreshOptions {
  threshold?: number;
  resistance?: number;
  refreshDelay?: number;
  disabled?: boolean;
}

interface UsePullToRefreshResult {
  /** 현재 당김 거리(px), 0~threshold로 clamp됨 */
  pullDistance: number;
  /** 임계값을 넘어 새로고침이 예약된 상태인지 여부 */
  isRefreshing: boolean;
}

const DEFAULT_THRESHOLD = 60;
const DEFAULT_RESISTANCE = 0.5;
const DEFAULT_REFRESH_DELAY = 450;

/**
 * 컨테이너 내부 스크롤이 최상단인 상태에서 아래로 당기는 제스처를 감지해
 * 임계값을 넘으면 페이지를 새로고침한다. (overscroll-behavior: none으로 막힌
 * 브라우저 기본 pull-to-refresh를 대체하는 커스텀 구현)
 *
 * 반환되는 pullDistance/isRefreshing으로 당김 중 시각 피드백(스피너 등)을
 * 그릴 수 있으며, 임계값 도달 시 즉시 reload하지 않고 refreshDelay만큼
 * 지연시켜 스피너가 한 번은 화면에 노출되도록 한다.
 */
export function usePullToRefresh(
  ref: RefObject<HTMLElement | null>,
  {
    threshold = DEFAULT_THRESHOLD,
    resistance = DEFAULT_RESISTANCE,
    refreshDelay = DEFAULT_REFRESH_DELAY,
    disabled = false,
  }: UsePullToRefreshOptions = {}
): UsePullToRefreshResult {
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const refreshing = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      if (refreshing.current) return;
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
      if (!pulling.current || startY.current === null || refreshing.current) return;
      const deltaY = e.touches[0].clientY - startY.current;
      if (deltaY <= 0) {
        setPullDistance(0);
        return;
      }

      const resisted = deltaY * resistance;
      setPullDistance(Math.min(resisted, threshold));

      if (resisted >= threshold) {
        pulling.current = false;
        startY.current = null;
        refreshing.current = true;
        setIsRefreshing(true);
        window.setTimeout(() => {
          window.location.reload();
        }, refreshDelay);
      }
    };

    const handleTouchEnd = () => {
      if (refreshing.current) return;
      pulling.current = false;
      startY.current = null;
      setPullDistance(0);
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ref, threshold, resistance, refreshDelay, disabled]);

  return { pullDistance, isRefreshing };
}
