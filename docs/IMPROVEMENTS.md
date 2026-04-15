# DeepThroath — Предложения по улучшению

> Обновлено: 2026-04-16. Анализ на основе текущего состояния кодовой базы.

---

## ✅ Исправлено (все критические и важные)

### Критические

| # | Проблема | Файл | Решение |
|---|----------|------|---------|
| 1 | **API ключи без валидации** | `src/red_team/runner.py` | `_require_env()` с понятным сообщением вместо `KeyError` |
| 2 | **Нет таймаута на вызовы моделей** | `src/red_team/runner.py` | `API_TIMEOUT = 60s` для Anthropic и OpenRouter |
| 3 | **Silent failure в storage** | `src/data/storage.py` | `logging.warning` с именем файла и причиной |
| 4 | **Нет защиты в `load_history()`** | `src/data/storage.py` | try/except на каждый файл, пустые пропускаются |
| 5 | **Нет обработки ошибок в callbacks** | `src/red_team/runner.py` | try/except в обоих callbacks, ошибка как ответ модели |

### Производительность

- ✅ `load_history()` читает ВСЕ parquet-файлы при каждом рефреше — добавлен `@st.cache_data(ttl=60)`
- ✅ Двойной вызов `get_owasp_category()` на каждую строку в `charts.py` — исправлено
- ✅ `st.dataframe()` в логах без пагинации — добавлена постраничная навигация

### Конфигурация

- ✅ Версии зависимостей не зафиксированы — зафиксированы точные версии в `requirements.txt`
- ✅ Пресеты судей захардкожены в `judges.py` — добавлена `register_custom_presets()` + YAML поддержка
- ✅ Нет валидации YAML-конфигов — добавлена валидация через Pydantic 2 в `run_redteam.py`
- ✅ URL OpenRouter захардкожен — теперь берётся из `OPENROUTER_BASE_URL` env

### CLI

- ✅ При неправильном имени `--target` не показывает доступные варианты — теперь выводит список

### UX / Dashboard

- ✅ **Сравнение двух сканов** — вкладка "Сравнение"
- ✅ **Индикатор загрузки** — `st.spinner("Загрузка результатов...")`
- ✅ **Пагинация логов** — 50 записей/страница
- ✅ **Экспорт диалогов JSON** — кнопка рядом с CSV
- ✅ **Markdown report** — альтернатива PDF через WeasyPrint (не требует системных зависимостей)

### Архитектура / Новые возможности

- ✅ **RAG Quality Evaluation** — `eval/` sub-system + deepeval метрики
- ✅ **Unified Dashboard** — `src/dashboard/unified_app.py` объединяет Red Team + Quality Eval
- ✅ **Quality Charts** — `src/dashboard/quality_charts.py`
- ✅ **Eval Storage** — `src/data/eval_storage.py`
- ✅ **Next.js Web Frontend** — `web/` с API routes
- ✅ **GitHub Actions workflow** — `.github/workflows/redteam.yml` (manual-dispatch)

---

## 🔴 Текущие проблемы (исправить в первую очередь)

| # | Проблема | Файл | Описание |
|---|----------|------|----------|
| 1 | **unified_app.py превышает лимит** | `src/dashboard/unified_app.py` | 666 строк при лимите 500. Нужно вынести логику вкладок в `src/dashboard/tabs/` |
| 2 | **CI/CD auto-triggers отключены** | `.github/workflows/redteam.yml` | Workflow настроен только на `workflow_dispatch`. Авто-запуск на push/PR/schedule не работает |

---

## 🟠 Важные (следующий приоритет)

### Производительность

- `unified_app.py` загружает и red team и eval данные при каждом рефреше — нужен `@st.cache_data` для eval тоже
- `list_eval_runs()` не имеет кэша — при большом количестве eval-запусков может тормозить

### Тесты

- `test_app_logic.py` тестирует `app.py`, но не `unified_app.py` — нужен `test_unified_app_logic.py`
- Нет тестов для Next.js frontend (API routes)

### UX

| Улучшение | Приоритет | Описание |
|-----------|-----------|----------|
| **Demo-данные при первом запуске** | Высокий | Пустой дашборд убивает первое впечатление |
| **Critical-блок поверх Score** | Высокий | Score 87/100 скрывает Critical ASR=100% |
| **Аннотации регрессий на тренде** | Средний | "Здесь упало из-за PR #142" |
| **Quality/Security combined view** | Средний | Таблица: модель, Security Score, Quality Score рядом |

---

## 🟡 Backlog (новые фичи)

| Фича | Ценность | Сложность | Статус |
|------|----------|-----------|--------|
| GitHub Actions auto-triggers | Высокая | Низкая | 🔜 |
| Мультимодельное тестирование | Высокая | Средняя | 🔜 |
| JUnit XML output | Высокая | Низкая | 🔜 |
| Slack/Webhook алерты | Высокая | Средняя | 🔜 |
| EU AI Act compliance-отчёт | Высокая | Средняя | 🔜 |
| Prometheus/JSON метрики | Средняя | Средняя | 🔜 |
| Plugin-система атак | Высокая | Высокая | 🔜 |
| AgentCallback (agentic testing) | Высокая | Высокая | 🔜 |
| RAG Security (indirect injection) | Высокая | Высокая | 🔜 |
| Scheduled monitoring | Средняя | Средняя | 🔜 |
| NIST AI RMF отчёт | Средняя | Средняя | 🔜 |

---

## 🔵 Тесты (текущее покрытие ~112 тестов)

**Протестировано:** ~112 тестов, все проходят (`pytest tests/ -v`)

| Модуль | Тест-файл | Тесты | Что покрыто |
|--------|-----------|-------|-------------|
| `src/data/storage.py` | `test_storage.py` | ✅ 12 | save/load/history/list_scan_files, битые файлы |
| `src/data/eval_storage.py` | `test_eval_storage.py` | ✅ 10 | eval runs list, quality_score, broken files |
| `src/reports/generator.py` | `test_generator.py` | ✅ 13 | Security score edge cases, required keys |
| `src/red_team/severity.py` | `test_severity.py` | ✅ 11 | OWASP registry, subtype matching, fallback |
| `scripts/run_redteam.py` | `test_cli.py` | ✅ 9 | CLI arg parsing, Pydantic validation, exit codes |
| `src/reports/pdf_export.py` | `test_pdf_export.py` | ✅ 17 | HTML+Markdown рендеринг, score delta, WeasyPrint mock |
| `src/dashboard/app.py` | `test_app_logic.py` | ✅ 14 | KPI-расчёты, cat_map, логика вкладки "Сравнение" |
| `src/red_team/runner.py` | `test_runner.py` | ✅ 3 | Callbacks, API calls |
| `src/data/transformer.py` | `test_transformer.py` | ✅ 5 | OWASP fields, ASR calc, empty handling |
| `src/dashboard/charts.py` | `test_charts.py` | ✅ 5 | Chart rendering |
| `src/dashboard/quality_charts.py` | `test_quality_charts.py` | ✅ 13 | Quality chart rendering, edge cases |

> Streamlit-компоненты (`st.*`) не тестируются headlessly — бизнес-логика вынесена в `test_app_logic.py`.
> `unified_app.py` не имеет dedicated тест-файла — нужен `test_unified_app_logic.py`.

---

## Рекомендуемый порядок реализации

1. **Рефакторинг `unified_app.py`** — вынести вкладки в `src/dashboard/tabs/`, снизить до <500 строк
2. **GitHub Actions auto-triggers** — 0.5 дня, высокая ценность для developer experience
3. **Demo-данные** — 1 день, максимальный эффект для первого впечатления
4. **Critical-блок поверх Score** — 1-2 дня, критично для UX
5. **Мультимодельное тестирование** — разблокирует enterprise use cases
6. **EU AI Act compliance-отчёт** — превращает DeepThroath в compliance tool
