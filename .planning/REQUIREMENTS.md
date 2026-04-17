# REQUIREMENTS.md — RAGAS Integration

## v1 Requirements

### Python Pipeline

- [ ] **RAGAS-01**: Пользователь может запустить RAGAS-оценку на существующем датасете из eval/datasets/ через Python-скрипт eval/eval_ragas_metrics.py
- [ ] **RAGAS-02**: Pipeline автоматически конвертирует датасет из формата DeepEval (question/actual_output/expected_output/retrieval_context) в формат RAGAS (SingleTurnSample)
- [ ] **RAGAS-03**: Pipeline вычисляет все 5 стандартных метрик: Faithfulness, AnswerRelevancy, ContextPrecision, ContextRecall, AnswerCorrectness
- [ ] **RAGAS-04**: Метрики контекста (ContextPrecision, ContextRecall) пропускаются gracefully если retrieval_context отсутствует в записи
- [ ] **RAGAS-05**: Pipeline сохраняет результаты в eval/results/{timestamp}_ragas/metrics.json в формате, совместимом с UI
- [ ] **RAGAS-06**: LLM judge настраивается через те же переменные окружения что и DeepEval (.env: OPENAI_API_KEY, OPENAI_BASE_URL)
- [ ] **RAGAS-07**: Pipeline поддерживает кастомные метрики из eval/custom_metrics/ (автодискавери Python классов)

### Dependencies

- [ ] **DEP-01**: ragas, langchain-openai, langchain-core добавлены в requirements.txt
- [ ] **DEP-02**: Установка зависимостей не ломает существующий deepeval==3.9.3

### API

- [ ] **API-01**: Next.js API endpoint /api/eval/ragas возвращает список RAGAS-сканов и метрики выбранного скана
- [ ] **API-02**: /api/eval (существующий DeepEval endpoint) игнорирует папки с _ragas суффиксом
- [ ] **API-03**: /api/eval/ragas поддерживает тот же интерфейс что /api/eval: ?scan=latest|{scanName}

### UI

- [ ] **UI-01**: Страница /eval содержит tab switcher "DeepEval | RAGAS" без изменения существующего DeepEval функционала
- [ ] **UI-02**: RAGAS вкладка отображает summary cards со средними значениями каждой метрики
- [ ] **UI-03**: RAGAS вкладка отображает таблицу результатов по каждой записи с badges для каждой метрики
- [ ] **UI-04**: RAGAS вкладка содержит selector для выбора скана (аналогично DeepEval)
- [ ] **UI-05**: Детали каждой записи раскрываются в accordion: вопрос, ответ, ground truth, контекст, объяснения метрик

### Custom Metrics

- [ ] **CUST-01**: Папка eval/custom_metrics/ содержит example_metric.py — рабочий пример кастомной метрики с подробными комментариями на русском
- [ ] **CUST-02**: UI содержит collapsible секцию "Кастомные метрики" с инструкцией по созданию и копируемым шаблоном

## v2 Requirements (отложено)

- Запуск RAGAS прямо из UI (кнопка Run) — требует HTTP API или WebSocket
- Сравнение нескольких сканов на одном экране
- NoiseSensitivity, AnswerSimilarity, ContextEntityRecall метрики
- Загрузка нового датасета через drag & drop на RAGAS вкладке

## Out of Scope

- Сравнительный дашборд RAGAS vs DeepEval — каждый фреймворк независим
- GigaChat как LLM judge для RAGAS — сложная интеграция через LangchainLLMWrapper
- Замена DeepEval на RAGAS — оба живут параллельно

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RAGAS-01 | Phase 1: Python Pipeline | Pending |
| RAGAS-02 | Phase 1: Python Pipeline | Pending |
| RAGAS-03 | Phase 1: Python Pipeline | Pending |
| RAGAS-04 | Phase 1: Python Pipeline | Pending |
| RAGAS-05 | Phase 1: Python Pipeline | Pending |
| RAGAS-06 | Phase 1: Python Pipeline | Pending |
| RAGAS-07 | Phase 1: Python Pipeline | Pending |
| DEP-01 | Phase 1: Python Pipeline | Pending |
| DEP-02 | Phase 1: Python Pipeline | Pending |
| API-01 | Phase 2: API Route | Pending |
| API-02 | Phase 2: API Route | Pending |
| API-03 | Phase 2: API Route | Pending |
| UI-01 | Phase 3: UI & Docs | Pending |
| UI-02 | Phase 3: UI & Docs | Pending |
| UI-03 | Phase 3: UI & Docs | Pending |
| UI-04 | Phase 3: UI & Docs | Pending |
| UI-05 | Phase 3: UI & Docs | Pending |
| CUST-01 | Phase 3: UI & Docs | Pending |
| CUST-02 | Phase 3: UI & Docs | Pending |
