# DeepThroath v2 — RAGAS Integration

## What This Is

Расширение существующей платформы DeepThroath v2: добавление вкладки RAGAS в раздел RAG Eval. Пользователи получат возможность оценивать качество RAG-систем через два независимых фреймворка — DeepEval (уже есть) и RAGAS — из единого интерфейса на странице /eval.

## Core Value

Запустить RAGAS-оценку на существующем датасете одним кликом и получить все стандартные метрики + инструкцию по созданию кастомных метрик.

## Requirements

### Validated

- ✓ DeepEval evaluation pipeline (AR, FA, CP, CR) — existing
- ✓ Python subprocess pattern для запуска eval — existing
- ✓ Датасет формат: JSON с полями question, expected_output, actual_output — existing
- ✓ Next.js 15 frontend + MiniMax light design system — existing

### Active

- [ ] Вкладка RAGAS внутри /eval (tab switcher: DeepEval | RAGAS)
- [ ] Python pipeline eval/eval_ragas_metrics.py (аналог eval_rag_metrics.py)
- [ ] Все стандартные RAGAS метрики: Faithfulness, AnswerRelevancy, ContextPrecision, ContextRecall, AnswerCorrectness + прочие доступные
- [ ] Конвертер датасета из текущего формата (question/expected_output/actual_output) в формат RAGAS (question/answer/contexts/ground_truth)
- [ ] Поддержка кастомных метрик RAGAS
- [ ] Встроенная документация по созданию кастомных метрик (прямо на странице)
- [ ] API endpoint /api/eval/ragas (аналог /api/eval)
- [ ] Хранение результатов в eval/results/ (аналогично DeepEval)

### Out of Scope

- Сравнительный дашборд RAGAS vs DeepEval — не нужен, каждый фреймворк независим
- Загрузка нового датасета через UI — используется тот же датасет что у DeepEval
- Отдельная страница /ragas — это вкладка внутри /eval

## Context

Проект уже имеет рабочий eval pipeline на DeepEval. RAGAS — это другой фреймворк оценки RAG, использующий схожие метрики но с другим подходом (LLM-as-judge через LangChain/OpenAI). Ключевое отличие: RAGAS требует формат EvaluationDataset с полями question, answer, contexts, ground_truth — нужен конвертер из текущего формата.

Текущий формат датасета: `id, category, question, expected_output, actual_output, _source_session, _source_category`
RAGAS формат: `question, answer, contexts (list), ground_truth`

Маппинг: question→question, actual_output→answer, retrieval_context→contexts, expected_output→ground_truth

## Constraints

- **Tech stack**: Python 3.10+, Next.js 15 TypeScript — не менять
- **Design**: MiniMax light theme — придерживаться существующего дизайна /eval
- **Pattern**: Python subprocess как в существующем eval pipeline — не переизобретать
- **Dataset**: reuse eval/datasets/ — не добавлять новый тип хранилища

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Вкладка внутри /eval, не отдельная страница | Логически связано с DeepEval, единый раздел оценки | — Pending |
| Python subprocess (не FastAPI) | Соответствует существующему паттерну, меньше инфраструктуры | — Pending |
| Конвертер датасета на лету | Избегаем дублирования хранилища | — Pending |

---
*Last updated: 2026-04-17 after initialization*
