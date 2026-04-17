# Roadmap: RAGAS Integration

## Overview

Три последовательные фазы доставляют полноценную интеграцию RAGAS в существующую платформу DeepThroath v2. Фаза 1 строит Python-пайплайн оценки, Фаза 2 добавляет API-маршрут Next.js, Фаза 3 завершает UI-вкладку с документацией по кастомным метрикам. Каждая фаза независимо верифицируема до перехода к следующей.

## Phases

- [ ] **Phase 1: Python Pipeline** - RAGAS eval pipeline с конвертером датасета, 5 метриками и поддержкой кастомных метрик
- [ ] **Phase 2: API Route** - Next.js endpoint /api/eval/ragas совместимый с существующим интерфейсом /api/eval
- [ ] **Phase 3: UI & Docs** - Вкладка RAGAS внутри /eval с таблицей результатов и документацией по кастомным метрикам

## Phase Details

### Phase 1: Python Pipeline
**Goal**: Разработчик может запустить RAGAS-оценку командой `python eval/eval_ragas_metrics.py` и получить результаты в eval/results/
**Depends on**: Nothing (first phase)
**Requirements**: RAGAS-01, RAGAS-02, RAGAS-03, RAGAS-04, RAGAS-05, RAGAS-06, RAGAS-07, DEP-01, DEP-02
**Success Criteria** (what must be TRUE):
  1. Запуск `python eval/eval_ragas_metrics.py` на существующем датасете завершается без ошибок и создаёт файл eval/results/{timestamp}_ragas/metrics.json
  2. metrics.json содержит вычисленные значения для всех 5 метрик: Faithfulness, AnswerRelevancy, ContextPrecision, ContextRecall, AnswerCorrectness
  3. Если в записях датасета отсутствует retrieval_context, скрипт не падает и пропускает контекстные метрики с предупреждением
  4. Скрипт использует OPENAI_API_KEY и OPENAI_BASE_URL из .env — тот же конфиг что у DeepEval
  5. Python-классы из eval/custom_metrics/ подхватываются автоматически при наличии папки
**Plans**: 3 plans
- [ ] 01-01-PLAN.md — Add RAGAS + langchain dependencies to requirements.txt
- [ ] 01-02-PLAN.md — Create custom_metrics/ package scaffold with ExampleCustomMetric
- [ ] 01-03-PLAN.md — Build eval/eval_ragas_metrics.py pipeline (API call, dataset, evaluate, save)

### Phase 2: API Route
**Goal**: Фронтенд может получить список RAGAS-сканов и метрики через /api/eval/ragas, существующий /api/eval не затронут
**Depends on**: Phase 1
**Requirements**: API-01, API-02, API-03
**Success Criteria** (what must be TRUE):
  1. GET /api/eval/ragas?scan=latest возвращает JSON с метриками последнего RAGAS-скана
  2. GET /api/eval/ragas?scan={scanName} возвращает метрики конкретного скана по имени
  3. GET /api/eval (существующий endpoint) не включает в ответ папки с суффиксом _ragas
**Plans**: 3 plans
- [ ] 01-01-PLAN.md — Add RAGAS + langchain dependencies to requirements.txt
- [ ] 01-02-PLAN.md — Create custom_metrics/ package scaffold with ExampleCustomMetric
- [ ] 01-03-PLAN.md — Build eval/eval_ragas_metrics.py pipeline (API call, dataset, evaluate, save)

### Phase 3: UI & Docs
**Goal**: Пользователь видит вкладку RAGAS внутри /eval, может выбрать скан и изучить результаты без ущерба для существующего DeepEval UI
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, CUST-01, CUST-02
**Success Criteria** (what must be TRUE):
  1. Страница /eval содержит переключатель "DeepEval | RAGAS", переключение не ломает существующий DeepEval функционал
  2. Вкладка RAGAS показывает summary cards со средними значениями каждой метрики и таблицу результатов по каждой записи датасета
  3. Клик на запись в таблице раскрывает accordion с вопросом, ответом, ground truth, контекстом и объяснениями метрик
  4. Selector сканов позволяет переключаться между доступными RAGAS-прогонами
  5. Секция "Кастомные метрики" содержит инструкцию на русском и копируемый шаблон Python-класса
**Plans**: 3 plans
- [ ] 01-01-PLAN.md — Add RAGAS + langchain dependencies to requirements.txt
- [ ] 01-02-PLAN.md — Create custom_metrics/ package scaffold with ExampleCustomMetric
- [ ] 01-03-PLAN.md — Build eval/eval_ragas_metrics.py pipeline (API call, dataset, evaluate, save)
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Python Pipeline | 0/TBD | Not started | - |
| 2. API Route | 0/TBD | Not started | - |
| 3. UI & Docs | 0/TBD | Not started | - |
