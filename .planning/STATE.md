# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Запустить RAGAS-оценку на существующем датасете одним кликом и получить все стандартные метрики + инструкцию по созданию кастомных метрик
**Current focus:** Phase 1 — Python Pipeline

## Current Position

Phase: 1 of 3 (Python Pipeline)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-17 — Roadmap создан, требования зафиксированы

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Setup: Вкладка внутри /eval, не отдельная страница — логически связано с DeepEval
- Setup: Python subprocess (не FastAPI) — соответствует существующему паттерну
- Setup: Конвертер датасета на лету — избегаем дублирования хранилища

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: langchain-openai отсутствует в requirements.txt — добавить DEP-01 первым шагом
- Phase 1: retrieval_context может отсутствовать в записях — graceful skip обязателен (RAGAS-04)
- Phase 3: Tab switcher должен извлечь существующий DeepEval UI в компонент без поломки

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | Кнопка Run в UI | Deferred | Init |
| v2 | Сравнение нескольких сканов | Deferred | Init |
| v2 | NoiseSensitivity, AnswerSimilarity метрики | Deferred | Init |

## Session Continuity

Last session: 2026-04-17
Stopped at: Roadmap создан, STATE.md инициализирован
Resume file: None
