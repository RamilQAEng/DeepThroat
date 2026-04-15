export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] space-y-8">
      <div className="text-center space-y-4 max-w-3xl">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
          DeepThroath
        </h1>
        <p className="text-lg text-white/80 leading-relaxed">
          Платформа для комплексного анализа безопасности и качества LLM-систем
        </p>
        <p className="text-sm text-white/60 max-w-2xl mx-auto">
          DeepThroath объединяет инструменты для тестирования на проникновение (Red Teaming),
          оценки качества RAG-систем и автоматизированного тестирования API в единый дашборд.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-8">
        <a
          href="/redteam"
          className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 hover:border-red-500/30 transition-all hover:shadow-lg hover:shadow-red-500/10"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white group-hover:text-red-400 transition-colors">
              Red Teaming
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Тестирование безопасности LLM на уязвимости по классификации OWASP.
              Автоматизированные атаки и расчет ASR метрик.
            </p>
          </div>
          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>

        <a
          href="/eval"
          className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 hover:border-blue-500/30 transition-all hover:shadow-lg hover:shadow-blue-500/10"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
              Evaluate RAG
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Оценка качества RAG-систем с помощью метрик Answer Relevance,
              Faithfulness, Context Precision и Context Recall.
            </p>
          </div>
          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>

        <a
          href="/runner"
          className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 hover:border-purple-500/30 transition-all hover:shadow-lg hover:shadow-purple-500/10"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
              API Runner
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Универсальный раннер для тестирования произвольных API.
              Поддержка кастомных контрактов, экстракторов и загрузки датасетов.
            </p>
          </div>
          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>
      </div>

      <div className="mt-12 text-center space-y-3">
        <p className="text-sm text-white/50">
          Выберите инструмент для начала работы
        </p>
      </div>
    </div>
  );
}
