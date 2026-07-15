import type { Metadata, Viewport } from "next";
import "./globals.css";
import MobileLayout from "@/app/components/layout/MobileLayout";
import AuthInit from "@/lib/AuthInit";
import Providers from "@/app/providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://youthpass.co.kr"),
  title: {
    default: "청년패스 - YOUTHPASS",
    template: "%s | 청년패스",
  },
  description:
    "전국에 흩어진 청년 지원 정책을 한곳에 모아, 내게 맞는 정책과 혜택을 추천해 드려요. 청년패스에서 놓치기 쉬운 청년 정책을 빠르게 확인하세요.",
  icons: {
    icon: "/images/tab-logo-cropped.png",
    shortcut: "/images/tab-logo-cropped.png",
    apple: "/images/tab-logo-cropped.png",
  },
  openGraph: {
    title: "청년패스",
    description:
      "전국에 흩어진 청년 지원 정책을 한곳에 모아, 내게 맞는 정책과 혜택을 추천해 드려요.",
    url: "https://youthpass.co.kr",
    siteName: "청년패스",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "청년패스",
    description:
      "전국에 흩어진 청년 지원 정책을 한곳에 모아, 내게 맞는 정책과 혜택을 추천해 드려요.",
    images: ["/images/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "청년패스",
  alternateName: "YOUTHPASS",
  url: "https://youthpass.co.kr",
  description:
    "전국에 흩어진 청년 지원 정책을 한곳에 모아, 내게 맞는 정책과 혜택을 추천해 드리는 청년 정책 통합 정보 서비스",
  inLanguage: "ko-KR",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <Providers>
          <AuthInit />
          <MobileLayout>{children}</MobileLayout>
        </Providers>
      </body>
    </html>
  );
}
