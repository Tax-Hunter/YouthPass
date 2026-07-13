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
  // 마지막 슬라이드 다음에 첫 슬라이드의 복제본을 붙여, 마지막 -> 처음 전환도 항상 정방향으로만 애니메이션되게 한다.
  const trackSlides = isLoopable ? [...slides, { ...slides[0], id: `${slides[0].id}-clone` }] : slides;

  const [trackIndex, setTrackIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const dragStartX = useRef<number | null>(null);
  const isDragging = useRef(false);

  const activeIndex = trackIndex >= slides.length ? 0 : trackIndex;

  const goToNext = () => {
    if (!isLoopable) return;
    setTransitionEnabled(true);
    setTrackIndex((prev) => prev + 1);
  };

  const goToPrev = () => {
    setTransitionEnabled(true);
    setTrackIndex((prev) => Math.max(0, prev - 1));
  };

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(index, slides.length - 1));
    setTransitionEnabled(true);
    setTrackIndex(clamped);
  };

  // 복제 슬라이드까지 정방향 애니메이션이 끝나면, 애니메이션 없이 실제 첫 슬라이드 위치로 되돌린다.
  const handleTransitionEnd = () => {
    if (trackIndex === slides.length) {
      setTransitionEnabled(false);
      setTrackIndex(0);
    }
  };

  useEffect(() => {
    if (transitionEnabled) return;
    const frame = requestAnimationFrame(() => setTransitionEnabled(true));
    return () => cancelAnimationFrame(frame);
  }, [transitionEnabled]);

  useEffect(() => {
    if (!isLoopable) return;

    const timer = setInterval(() => {
      goToNext();
    }, AUTO_PLAY_INTERVAL);

    return () => clearInterval(timer);
  }, [trackIndex, isLoopable]);

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
