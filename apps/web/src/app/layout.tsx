import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/shell/Header";
import { Footer } from "@/components/shell/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f6f2",
};

export const metadata: Metadata = {
  title: {
    default: "OmniPlay | Web Games",
    template: "%s | OmniPlay",
  },
  description:
    "A quiet, beautifully crafted collection of browser games. Board classics and arcade physics with zero distractions.",
  keywords: ["games", "web games", "board games", "arcade", "tic-tac-toe"],
  authors: [{ name: "OmniPlay" }],
  openGraph: {
    title: "OmniPlay | Web Games",
    description: "Quiet, beautifully crafted browser games.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f7f6f2] text-[#1c1917] font-sans selection:bg-[#fed7aa] selection:text-[#7c2d12]">
        {/* Skip to Content for Accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-3.5 focus:py-1.5 focus:bg-[#1c1917] focus:text-white focus:rounded-lg focus:text-xs focus:font-medium focus:shadow-md"
        >
          Skip to main content
        </a>

        <Header />
        <main id="main-content" className="flex-1 flex flex-col">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
