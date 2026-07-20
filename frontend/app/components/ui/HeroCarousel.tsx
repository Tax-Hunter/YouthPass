"use client";

import React, { useEffect, useRef, useState } from "react";

export interface HeroCarouselSlide {
  id: string;
  content: React.ReactNode;
}

interface HeroCarouselProps {
  slides: HeroCarouselSlide[];
  className?: string;
}

const AUTO_PLAY_INTERVAL = 3000;
const SWIPE_THRESHOLD = 40;

export default function HeroCarousel({ slides, className = "" }: HeroCarouselProps) {
  const isLoopable = slides.length > 1;
  // 앞뒤로 모두 순환하도록, 맨 앞엔 마지막 슬라이드의 복제본을, 맨 뒤엔 첫 슬라이드의 복제본을 붙인다.
  // 실제 슬라이드는 offset(1)만큼 밀려서 trackSlides에 위치한다.
  const offset = isLoopable ? 1 : 0;
  const trackSlides = isLoopable
    ? [
        { ...slides[slides.length - 1], id: `${slides[slides.length - 1].id}-clone-start` },
        ...slides,
        { ...slides[0], id: `${slides[0].id}-clone-end` },
      ]
    : slides;

  const [trackIndex, setTrackIndex] = useState(offset);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const dragStartX = useRef<number | null>(null);
  const isDragging = useRef(false);

  const activeIndex = isLoopable
    ? (((trackIndex - offset) % slides.length) + slides.length) % slides.length
    : trackIndex;

  const goToNext = () => {
    if (!isLoopable) return;
    setTransitionEnabled(true);
    setTrackIndex((prev) => prev + 1);
  };

  const goToPrev = () => {
    if (!isLoopable) {
      setTransitionEnabled(true);
      setTrackIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    setTransitionEnabled(true);
    setTrackIndex((prev) => prev - 1);
  };

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(index, slides.length - 1));
    setTransitionEnabled(true);
    setTrackIndex(clamped + offset);
  };

  // 앞/뒤 복제 슬라이드까지 애니메이션이 끝나면, 애니메이션 없이 실제 슬라이드 위치로 되돌린다.
  const handleTransitionEnd = () => {
    if (!isLoopable) return;
    if (trackIndex === trackSlides.length - 1) {
      setTransitionEnabled(false);
      setTrackIndex(offset);
    } else if (trackIndex === 0) {
      setTransitionEnabled(false);
      setTrackIndex(slides.length);
    }
  };

  useEffect(() => {
    if (transitionEnabled) return;
    const frame = requestAnimationFrame(() => setTransitionEnabled(true));
    return () => cancelAnimationFrame(frame);
  }, [transitionEnabled]);

  // 탭이 백그라운드로 가면(visibilitychange → hidden) 오토플레이 타이머를 정지시켜, 렌더링이 멈춘
  // 동안 trackIndex가 transitionend 보정 없이 무한정 누적되는 것을 막는다. 탭 복귀(visible) 시
  // 타이머를 재시작하고, 혹시라도 유효 범위를 벗어나 있으면 트랜지션 없이 정상 위치로 스냅시킨다.
  useEffect(() => {
    if (!isLoopable) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const startTimer = () => {
      if (timer !== null) return;
      timer = setInterval(goToNext, AUTO_PLAY_INTERVAL);
    };

    const stopTimer = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopTimer();
        return;
      }
      setTrackIndex((prev) => {
        const normalizedIndex = offset + (((prev - offset) % slides.length) + slides.length) % slides.length;
        if (prev !== normalizedIndex) setTransitionEnabled(false);
        return normalizedIndex;
      });
      startTimer();
    };

    if (document.visibilityState !== "hidden") startTimer();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isLoopable, offset, slides.length]);

  const handleDragStart = (clientX: number) => {
    dragStartX.current = clientX;
    isDragging.current = true;
  };

  const handleDragEnd = (clientX: number) => {
    if (dragStartX.current === null) return;
    const deltaX = clientX - dragStartX.current;

    if (deltaX > SWIPE_THRESHOLD) {
      goToPrev();
    } else if (deltaX < -SWIPE_THRESHOLD) {
      goToNext();
    }
    dragStartX.current = null;
    isDragging.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => handleDragEnd(e.changedTouches[0].clientX);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  };
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    handleDragEnd(e.clientX);
  };
  const handleMouseLeave = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    handleDragEnd(e.clientX);
  };

  if (slides.length === 0) return null;

  return (
    <div className={`relative overflow-hidden shrink-0 ${className}`}>
      <div
        className={`flex select-none cursor-grab active:cursor-grabbing ${
          transitionEnabled ? "transition-transform duration-300 ease-out" : ""
        }`}
        style={{ transform: `translateX(-${trackIndex * 100}%)` }}
        onTransitionEnd={handleTransitionEnd}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {trackSlides.map((slide) => (
          <div key={slide.id} className="w-full shrink-0">
            {slide.content}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 z-20 flex items-center justify-center gap-1.5">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => goTo(index)}
              aria-label={`${index + 1}번째 배너로 이동`}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex ? "w-5 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
