import type { NextConfig } from "next";

// 백엔드 실제 origin (서버 전용 — 브라우저에 노출되지 않음).
// 브라우저는 항상 프론트엔드와 동일 origin의 /api/*로만 요청하고, Next.js 서버가 이 값으로 프록시한다.
// 모바일 Safari ITP 등 서드파티/크로스사이트 쿠키 차단 정책의 영향을 받지 않도록 하기 위함 — refresh_token 쿠키를 first-party로 유지.
const apiProxyTarget = process.env.API_PROXY_TARGET;

if (!apiProxyTarget) {
  throw new Error("API_PROXY_TARGET 환경변수가 설정되지 않았습니다.");
}

if (!apiProxyTarget.includes("://")) {
  throw new Error(
    "API_PROXY_TARGET은 반드시 http:// 또는 https://로 시작하는 절대 URL이어야 합니다. (현재 값: " + apiProxyTarget + ")"
  );
}

if (process.env.NODE_ENV === "production" && apiProxyTarget.startsWith("http://")) {
  throw new Error(
    "API_PROXY_TARGET은 프로덕션 환경에서 반드시 https://로 시작해야 합니다."
  );
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
