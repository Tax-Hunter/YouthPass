import type { Metadata } from "next";
import "./globals.css";
import MobileLayout from "@/app/components/layout/MobileLayout";
import { AuthProvider } from "@/lib/AuthContext";

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
        <AuthProvider>
          <MobileLayout>{children}</MobileLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
