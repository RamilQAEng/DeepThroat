import type { Metadata } from "next";
import "./globals.css";

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
      className="h-full antialiased dark font-sans"
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
                 <a href="/" className="font-extrabold text-2xl tracking-tighter bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
                    DeepThroath
                 </a>
                 <nav className="flex items-center gap-3">
                    <a href="/redteam" className="text-base font-semibold text-white/90 hover:text-white px-4 py-2.5 rounded-lg hover:bg-white/10 border border-transparent hover:border-white/20 transition-all drop-shadow-sm flex items-center gap-2">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                       </svg>
                       Red Teaming
                    </a>
                    <a href="/eval" className="text-base font-semibold text-white/90 hover:text-white px-4 py-2.5 rounded-lg hover:bg-white/10 border border-transparent hover:border-white/20 transition-all drop-shadow-sm flex items-center gap-2">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                       </svg>
                       Evaluate RAG
                    </a>
                    <a href="/runner" className="text-base font-semibold text-white/90 hover:text-white px-4 py-2.5 rounded-lg hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-purple-500/20 border border-transparent hover:border-cyan-500/30 transition-all drop-shadow-sm flex items-center gap-2">
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
      </body>
    </html>
  );
}
