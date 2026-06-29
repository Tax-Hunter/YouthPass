import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error("NEXT_PUBLIC_API_URL 환경변수가 설정되지 않았습니다.");
}

if (process.env.NODE_ENV === "production" && apiUrl.startsWith("http://")) {
  throw new Error(
    "NEXT_PUBLIC_API_URL은 프로덕션 환경에서 반드시 https://로 시작해야 합니다."
  );
}

const nextConfig: NextConfig = {};

export default nextConfig;
