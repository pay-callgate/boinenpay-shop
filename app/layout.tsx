import React from "react";
import type { Metadata, Viewport } from "next";
import { KakaoInAppBrowserGate } from "@/components/KakaoInAppBrowserGate";
import { SessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Call-Link Shopping Mall",
  description: "콜링크 쇼핑몰 플랫폼",
  icons: {
    icon: [{ url: "/favicon.ico", type: "image/x-icon" }],
    shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
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
        <SessionProvider>
          <KakaoInAppBrowserGate />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

