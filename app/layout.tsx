import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
// Pretendard (v3 기본 글꼴). 한글·영문·숫자를 한 글꼴로 맞춰서 기기마다 글자 모양이
// 달라지지 않게 한다. dynamic-subset 은 화면에 나온 글자 범위만 받아 와서 처음 열 때
// 무겁지 않다. 외부 CDN 에 기대지 않도록 패키지에서 가져와 앱과 같은 주소로 내보낸다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FitNote | 나의 운동 알림장",
  description: "트레이너와 회원을 위한 운동 기록, 식단, PT 일정 관리 서비스",
  appleWebApp: {
    capable: true,
    title: "FitNote",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
