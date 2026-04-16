export default function HomePage() {
  return (
    <div className="flex flex-col items-center py-20 space-y-16">

      {/* Hero */}
      <div className="text-center space-y-5 max-w-3xl">
        <h1
          className="text-[64px] font-medium leading-[1.10] tracking-tight text-[#222222]"
          style={{ fontFamily: "var(--font-outfit, Outfit)" }}
        >
          DeepThroath
        </h1>
        <p className="text-xl font-medium text-[#45515e] leading-relaxed max-w-xl mx-auto">
          Платформа для комплексного анализа безопасности и качества LLM-систем
        </p>
        <p className="text-base text-[#8e8e93] max-w-2xl mx-auto leading-relaxed">
          Объединяет инструменты для Red Teaming, оценки RAG-систем и автоматизированного тестирования API в единый дашборд.
        </p>
      </div>

      {/* Product cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">

        {/* Red Teaming */}
        <a
          href="/redteam"
          className="group relative overflow-hidden rounded-[24px] p-6 transition-all hover:-translate-y-1"
          style={{
            background: "linear-gradient(135deg, #ff6b6b 0%, #c0392b 50%, #8e1a1a 100%)",
            boxShadow: "rgba(44, 30, 116, 0.16) 0px 0px 15px",
          }}
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3
                className="text-[28px] font-medium leading-tight text-white"
                style={{ fontFamily: "var(--font-outfit, Outfit)" }}
              >
                Red Teaming
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                Тестирование безопасности LLM на уязвимости по классификации OWASP. Автоматизированные атаки и расчет ASR метрик.
              </p>
            </div>
          </div>
          <div className="absolute bottom-5 right-5 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>

        {/* Evaluate RAG */}
        <a
          href="/eval"
          className="group relative overflow-hidden rounded-[24px] p-6 transition-all hover:-translate-y-1"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #1456f0 50%, #0d3bba 100%)",
            boxShadow: "rgba(44, 30, 116, 0.16) 0px 0px 15px",
          }}
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3
                className="text-[28px] font-medium leading-tight text-white"
                style={{ fontFamily: "var(--font-outfit, Outfit)" }}
              >
                Evaluate RAG
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                Оценка качества RAG-систем с помощью метрик Answer Relevance, Faithfulness, Context Precision и Context Recall.
              </p>
            </div>
          </div>
          <div className="absolute bottom-5 right-5 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>

        {/* API Runner */}
        <a
          href="/runner"
          className="group relative overflow-hidden rounded-[24px] p-6 transition-all hover:-translate-y-1"
          style={{
            background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #4c1d95 100%)",
            boxShadow: "rgba(44, 30, 116, 0.16) 0px 0px 15px",
          }}
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3
                className="text-[28px] font-medium leading-tight text-white"
                style={{ fontFamily: "var(--font-outfit, Outfit)" }}
              >
                API Runner
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                Универсальный раннер для тестирования произвольных API. Поддержка кастомных контрактов, экстракторов и загрузки датасетов.
              </p>
            </div>
          </div>
          <div className="absolute bottom-5 right-5 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>
      </div>

      <p className="text-sm text-[#8e8e93]">Выберите инструмент для начала работы</p>
    </div>
  );
}
