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
            <div className="text-3xl">🛡️</div>
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
            <div className="text-3xl">📊</div>
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
            <div className="text-3xl">🚀</div>
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
