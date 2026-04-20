"use client";

import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function OwaspInfoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-[#e5e7eb] bg-white hover:bg-[#f2f3f5] text-[#222222] shadow-sm hover:shadow-md transition-all rounded-lg"
        >
          <Info className="w-4 h-4 mr-2" />
          Что такое OWASP LLM Top 10?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white text-[#222222]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#222222] flex items-center gap-2">
            <span className="text-3xl">🛡️</span>
            OWASP LLM Top 10
          </DialogTitle>
          <DialogDescription className="text-[#45515e] text-base">
            Стандарт безопасности для приложений на основе больших языковых моделей
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <section>
            <h3 className="text-lg font-bold text-[#222222] mb-3">Что это такое?</h3>
            <p className="text-[#45515e] leading-relaxed">
              <strong>OWASP LLM Top 10</strong> — это проект Open Worldwide Application Security Project (OWASP),
              который определяет 10 наиболее критичных уязвимостей безопасности в приложениях,
              использующих большие языковые модели (LLM).
            </p>
          </section>

          <section className="border-t border-[#e5e7eb] pt-6">
            <h3 className="text-lg font-bold text-[#222222] mb-4">Топ-10 категорий уязвимостей:</h3>
            <div className="space-y-4">
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4">
                <h4 className="font-bold text-[#dc2626] mb-1">🔴 LLM01: Prompt Injection</h4>
                <p className="text-sm text-[#45515e]">
                  Манипуляция промптом для обхода инструкций и выполнения несанкционированных действий.
                </p>
              </div>

              <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-lg p-4">
                <h4 className="font-bold text-[#ea580c] mb-1">🟠 LLM02: Insecure Output Handling</h4>
                <p className="text-sm text-[#45515e]">
                  Небезопасная обработка вывода модели перед использованием в других системах.
                </p>
              </div>

              <div className="bg-[#fefce8] border border-[#fde68a] rounded-lg p-4">
                <h4 className="font-bold text-[#ca8a04] mb-1">🟡 LLM05: Supply Chain Vulnerabilities</h4>
                <p className="text-sm text-[#45515e]">
                  Использование скомпрометированных моделей, данных или плагинов.
                </p>
              </div>

              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4">
                <h4 className="font-bold text-[#dc2626] mb-1">🔴 LLM06: Excessive Agency</h4>
                <p className="text-sm text-[#45515e]">
                  Предоставление модели избыточных прав доступа к инструментам и API.
                </p>
              </div>

              <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-lg p-4">
                <h4 className="font-bold text-[#ea580c] mb-1">🟠 LLM07: Data Leakage</h4>
                <p className="text-sm text-[#45515e]">
                  Утечка конфиденциальных данных через системный промпт или обучающую выборку.
                </p>
              </div>

              <div className="bg-[#fefce8] border border-[#fde68a] rounded-lg p-4">
                <h4 className="font-bold text-[#ca8a04] mb-1">🟡 LLM08: Vector & Embedding Weaknesses</h4>
                <p className="text-sm text-[#45515e]">
                  Манипуляция данными в векторных базах для RAG-атак.
                </p>
              </div>

              <div className="bg-[#fefce8] border border-[#fde68a] rounded-lg p-4">
                <h4 className="font-bold text-[#ca8a04] mb-1">🟡 LLM09: Misinformation & Content Issues</h4>
                <p className="text-sm text-[#45515e]">
                  Генерация дезинформации, токсичного или предвзятого контента.
                </p>
              </div>

              <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg p-4">
                <h4 className="font-bold text-[#16a34a] mb-1">🟢 LLM10: Unbounded Consumption</h4>
                <p className="text-sm text-[#45515e]">
                  Отсутствие лимитов на потребление ресурсов, приводящее к DoS или высоким затратам.
                </p>
              </div>
            </div>
          </section>

          <section className="border-t border-[#e5e7eb] pt-6">
            <h3 className="text-lg font-bold text-[#222222] mb-3">Как работает DeepThroath?</h3>
            <p className="text-[#45515e] leading-relaxed mb-3">
              DeepThroath автоматически тестирует вашу LLM-систему на соответствие стандарту OWASP LLM Top 10:
            </p>
            <ul className="space-y-2 text-[#45515e]">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold mt-1">✓</span>
                <span>Генерирует adversarial-атаки для каждой категории уязвимостей</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold mt-1">✓</span>
                <span>Использует LLM-as-a-Judge для оценки ответов модели</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold mt-1">✓</span>
                <span>Рассчитывает метрики: ASR (Attack Success Rate) и Security Score</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold mt-1">✓</span>
                <span>Предоставляет детальные рекомендации по устранению уязвимостей</span>
              </li>
            </ul>
          </section>

          <section className="border-t border-[#e5e7eb] pt-6">
            <h3 className="text-lg font-bold text-[#222222] mb-3">Полезные ссылки</h3>
            <div className="space-y-2">
              <a
                href="https://owasp.org/www-project-top-10-for-large-language-model-applications/"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
              >
                → Официальная документация OWASP LLM Top 10
              </a>
              <a
                href="https://github.com/InfernYaCr/DeepThroath"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
              >
                → Репозиторий DeepThroath на GitHub
              </a>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
