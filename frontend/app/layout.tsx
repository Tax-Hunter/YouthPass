import type { Metadata } from "next";
import "./globals.css";
import MobileLayout from "@/app/components/layout/MobileLayout";
import AuthInit from "@/lib/AuthInit";

export const metadata: Metadata = {
  title: "청년패스 — UI Design",
  description: "Youth Policy Platform Mobile App UI Screens",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AuthInit />
        <MobileLayout>{children}</MobileLayout>
      </body>
    </html>
  );
}
