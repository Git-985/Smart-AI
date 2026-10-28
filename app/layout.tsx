import type { Metadata } from "next";
import { AccessibilityProvider } from "@/components/accessibility-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart AI | 明白办",
  description: "让公共服务办理更清楚、更安心。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><AccessibilityProvider>{children}</AccessibilityProvider></body>
    </html>
  );
}
