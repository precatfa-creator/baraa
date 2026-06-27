import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";

// Tajawal owns --font-sans so shadcn's `font-sans` base style renders Arabic.
const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "براء",
  description: "نظام إدارة نواقص الصيدلية",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
