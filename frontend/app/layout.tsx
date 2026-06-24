import type { Metadata } from "next";
import "./globals.css";
import MobileLayout from "@/app/components/layout/MobileLayout";

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
        <MobileLayout>{children}</MobileLayout>
      </body>
    </html>
  );
}
