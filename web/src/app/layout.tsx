import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const interFont = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
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
    <html
      lang="en"
      className={`${interFont.variable} h-full antialiased dark font-sans`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-white relative overflow-x-hidden font-sans">
        
        {/* Glow / Aurora Effects */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-color-dodge opacity-60">
            <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-purple-900/30 blur-[130px]"></div>
            <div className="absolute top-20 right-0 w-[500px] h-[500px] rounded-full bg-pink-900/20 blur-[120px]"></div>
            <div className="absolute bottom-[-100px] left-1/3 w-[800px] h-[800px] rounded-full bg-blue-900/20 blur-[150px]"></div>
        </div>

        <header className="border-b border-white/5 bg-slate-950/40 backdrop-blur-xl sticky top-0 z-50">
           <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
              <div className="flex items-center gap-8">
                 <span className="font-extrabold text-2xl tracking-tighter bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                    DeepThroath<span className="text-purple-500">_</span>
                 </span>
                 <nav className="flex items-center gap-3">
                    <a href="/" className="text-base font-semibold text-white/90 hover:text-white px-4 py-2.5 rounded-lg hover:bg-white/10 border border-transparent hover:border-white/20 transition-all drop-shadow-sm">🛡️ Red Teaming</a>
                    <a href="/eval" className="text-base font-semibold text-white/90 hover:text-white px-4 py-2.5 rounded-lg hover:bg-white/10 border border-transparent hover:border-white/20 transition-all drop-shadow-sm">📊 Evaluate RAG</a>
                    <a href="/runner" className="text-base font-semibold text-white/90 hover:text-white px-4 py-2.5 rounded-lg hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-purple-500/20 border border-transparent hover:border-cyan-500/30 transition-all drop-shadow-sm">🚀 API Runner</a>
                 </nav>
              </div>
           </div>
        </header>

        <main className="flex-1 relative z-10 w-full max-w-[1400px] mx-auto px-6 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
