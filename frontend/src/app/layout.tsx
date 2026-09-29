import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PortAtlas", template: "%s | PortAtlas" },
  description: "Tìm nhanh service, server, cổng và lệnh vận hành trong mạng nội bộ.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4">
          Đến nội dung chính
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
