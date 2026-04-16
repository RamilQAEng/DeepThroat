import type { Metadata } from "next";
import { DM_Sans, Outfit } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "DeepThroath — Аналитика",
  description: "Аналитика безопасности и качества для LLM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${dmSans.variable} ${outfit.variable}`}>
      <body className="min-h-full flex flex-col bg-white text-[#222222] relative overflow-x-hidden">

        <header className="sticky top-0 z-50 bg-white border-b border-[#f2f3f5]">
          <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <a
                href="/"
                className="font-display font-600 text-xl tracking-tight text-[#181e25] hover:opacity-80 transition-opacity"
                style={{ fontFamily: "var(--font-outfit, Outfit)", fontWeight: 600 }}
              >
                DeepThroath
              </a>
              <nav className="flex items-center gap-1">
                <a
                  href="/redteam"
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-[#45515e] hover:text-[#181e25] hover:bg-black/5 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Red Teaming
                </a>
                <a
                  href="/eval"
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-[#45515e] hover:text-[#181e25] hover:bg-black/5 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Evaluate RAG
                </a>
                <a
                  href="/runner"
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-[#45515e] hover:text-[#181e25] hover:bg-black/5 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  API Runner
                </a>
              </nav>
            </div>
          </div>
        </header>

        <main className="flex-1 relative z-10 w-full max-w-[1400px] mx-auto px-6 py-10">
          {children}
        </main>

        <footer className="bg-[#181e25] text-white/80 mt-auto">
          <div className="max-w-[1400px] mx-auto px-6 py-8 flex items-center justify-between text-sm">
            <span style={{ fontFamily: "var(--font-outfit, Outfit)", fontWeight: 600 }} className="text-white">
              DeepThroath
            </span>
            <span className="text-white/40 text-xs">LLM Security & Quality Platform</span>
          </div>
        </footer>

      </body>
    </html>
  );
}
