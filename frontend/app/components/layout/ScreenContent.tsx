import React from "react";

interface ScreenContentProps {
  children: React.ReactNode;
  /** 헤더 아래 세로 여백 프리셋 — 화면 특성에 따라 선택 */
  topPadding?: "header" | "header-list" | "none";
  /** 하단 여백 — 플로팅 버튼 등으로 콘텐츠가 가려지는 경우 확보 */
  bottomPadding?: "none" | "safe" | "24";
  className?: string;
}

/**
 * 화면 좌우 여백(px-screen)·세로 여백(pt-header 등)·스크롤 동작을 한 곳에서
 * 관리하는 공용 컨텐츠 컨테이너. 모든 화면의 최상위 스크롤 영역은 이 컴포넌트로
 * 감싼다 — 값/구조를 바꿀 때 이 파일 한 곳만 수정하면 전체 화면에 반영된다.
 *
 * scrollbar-gutter: stable(레이아웃 흔들림 방지용)은 의도적으로 쓰지 않는다 —
 * 이 속성은 스크롤 요소 자신뿐 아니라 그 안의 모든 자손이 쓸 수 있는 폭 자체를
 * 줄여버려서, ScreenBleed의 음수 마진(-mx-6)으로 상쇄할 수 없는 우측 간격을
 * 만든다(자세한 경위는 workflow/28_fix/phase4, phase5 문서 참고).
 */
const ScreenContent = React.forwardRef<HTMLDivElement, ScreenContentProps>(
  function ScreenContent(
    { children, topPadding = "header", bottomPadding = "none", className = "" },
    ref,
  ) {
    const topClass =
      topPadding === "header"
        ? "pt-header"
        : topPadding === "header-list"
          ? "pt-header-list"
          : "";
    const bottomClass =
      bottomPadding === "safe" ? "pb-safe" : bottomPadding === "24" ? "pb-24" : "";

    return (
      <div
        ref={ref}
        className={`flex-1 min-h-0 w-full overflow-y-auto px-screen ${topClass} ${bottomClass} ${className}`.trim()}
      >
        {children}
      </div>
    );
  },
);

export default ScreenContent;

/**
 * ScreenContent 내부에서 배경/구분선을 화면 끝까지 번지게(edge-to-edge) 해야 할 때
 * 감싸는 래퍼. ScreenContent의 좌우 패딩(px-screen)을 상쇄한 뒤, 자신의 className으로
 * 내부 콘텐츠 여백을 다시 지정한다(보통 `px-screen`을 함께 준다).
 */
export function ScreenBleed({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <div className={`-mx-6 ${className}`.trim()}>{children}</div>;
}
