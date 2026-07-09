import type { Metadata, Viewport } from "next";
import "./globals.css";
import MobileLayout from "@/app/components/layout/MobileLayout";
import AuthInit from "@/lib/AuthInit";
import Providers from "@/app/providers";

export const metadata: Metadata = {
  title: "청년패스 — UI Design",
  description: "Youth Policy Platform Mobile App UI Screens",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <AuthInit />
          <MobileLayout>{children}</MobileLayout>
        </Providers>
      </body>
    </html>
  );
}
