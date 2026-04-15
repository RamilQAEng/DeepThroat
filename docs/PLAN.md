# DeepThroath — LLM Red Teaming Analytics Platform

## Текущий статус (2026-04-16)

**Платформа полностью реализована и готова к использованию.**

| Этап | Статус | Описание |
|------|--------|----------|
| 1. Attack Integration | ✅ Готово | Async callbacks, DeepTeam 1.0.6, OpenRouter |
| 2. Data Layer | ✅ Готово | Transformer (real RiskAssessment API), Parquet storage, Eval Storage |
| 3. Dashboard | ✅ Готово | Unified Streamlit UI (Red Team + Quality Eval), OWASP expanders, PDF/Markdown export |
| 4. CI/CD | ✅ Готово (частично) | GitHub Actions workflow создан, manual-dispatch; auto-triggers — backlog |
| 5. Client Reports | ✅ Готово | PDF/HTML/Markdown через Jinja2 + WeasyPrint |
| 6. RAG Quality Eval | ✅ Готово | deepeval метрики, eval/ sub-system, quality charts |
| 7. Web Frontend | ✅ Готово | Next.js приложение с runner, dashboard, eval страницами |

### Быстрый старт

```bash
source .venv/bin/activate

# Запустить сканирование безопасности
python scripts/run_redteam.py --target qwen-7b --judge gemini-flash

# Запустить оценку качества (из директории eval/)
cd eval && python scripts/run_eval.py

# Открыть unified дашборд (Red Team + Quality Eval)
streamlit run src/dashboard/unified_app.py

# Или запустить web-интерфейс
cd web && npm run dev
```

---

## Концепция

Аналитическая платформа, объединяющая:
- Автоматизированное состязательное тестирование (Red Teaming) через DeepTeam
- Оценку качества RAG-систем через deepeval
- Интерактивную визуализацию метрик на фронтенде (Streamlit + Next.js)

---

## Метрики и KPI

| Метрика | Описание | Целевое значение |
|---------|----------|-----------------|
| **Binary Score** | LLM-as-a-Judge: 0 (safe) / 1 (unsafe) | Уровень отдельного теста |
| **ASR** (Attack Success Rate) | % атак, взломавших модель | Чем ниже — тем лучше |
| **pass_rate** | % тестов, которые модель выдержала | Чем выше — тем лучше |
| **Security Score** | Взвешенная оценка 0–100 с учётом критичности | Чем выше — тем лучше |
| **Quality Score** | Взвешенная оценка качества RAG 0–100 | Чем выше — тем лучше |
| **Answer Relevancy** | Насколько ответ соответствует вопросу | 0.0–1.0 |
| **Faithfulness** | Насколько ответ соответствует контексту | 0.0–1.0 |
| **Severity (OWASP)** | Критичность по OWASP Top 10 LLM | Critical / High / Medium / Low |

### OWASP Top 10 LLM — Градация критичности

| ID | Категория | Severity |
|----|-----------|----------|
| LLM01 | Prompt Injection | Critical |
| LLM02 | Insecure Output Handling | High |
| LLM05 | Supply Chain Vulnerabilities | High |
| LLM06 | Excessive Agency | Critical |
| LLM07 | System Prompt / PII Leakage | High |
| LLM08 | Vector/Embedding Weaknesses | Medium |
| LLM09 | Misinformation / Toxicity / Bias | Medium |
| LLM10 | Unbounded Consumption | Low |

---

## Архитектура проекта

```
RedTeaming DeepThroath v2/
├── src/
│   ├── red_team/
│   │   ├── runner.py          # Async model_callback + run_red_team()
│   │   ├── attacks.py         # Конфигурация атак и уязвимостей
│   │   ├── judges.py          # LLM-as-a-Judge: OpenRouter, Ollama, OpenAI
│   │   └── severity.py        # OWASP registry + smart name matching
│   ├── data/
│   │   ├── transformer.py     # RiskAssessment → DataFrame
│   │   ├── storage.py         # Parquet read/write + история
│   │   └── eval_storage.py    # Eval results JSON → DataFrame
│   ├── dashboard/
│   │   ├── unified_app.py     # Основной Streamlit (Red Team + Quality)
│   │   ├── app.py             # Red-team-only дашборд
│   │   ├── charts.py          # Plotly: pie, bar, trend, heatmap
│   │   ├── quality_charts.py  # Plotly: AR bar, scatter, trend
│   │   └── logs_table.py      # Таблица диалогов с фильтрами
│   └── reports/
│       ├── generator.py       # Security Score + контекст отчёта
│       ├── pdf_export.py      # Jinja2 HTML → WeasyPrint PDF + Markdown
│       └── templates/         # report.html + report.css + report.md
├── config/
│   ├── targets.yaml           # Целевые модели
│   └── attack_config.yaml     # Атаки, пороги, judge preset
├── scripts/
│   └── run_redteam.py         # CLI точка входа
├── eval/                      # RAG quality evaluation
│   ├── eval_rag_metrics.py    # deepeval-based runner
│   ├── scripts/run_eval.py    # CLI точка входа
│   ├── config/                # eval_config.yaml + targets.yaml
│   └── results/               # Timestamped eval results
├── web/                       # Next.js web frontend
│   ├── src/app/               # Pages: /, /redteam, /runner, /eval
│   └── src/components/        # DashboardCharts, LogsTable, ComparisonTab
├── tests/                     # pytest (112+ тестов)
│   ├── test_runner.py
│   ├── test_transformer.py
│   ├── test_storage.py
│   ├── test_eval_storage.py
│   ├── test_severity.py
│   ├── test_charts.py
│   ├── test_quality_charts.py
│   ├── test_cli.py
│   ├── test_generator.py
│   ├── test_pdf_export.py
│   └── test_app_logic.py
├── docs/                      # Документация
└── results/                   # Генерируемые данные (gitignore)
    ├── latest.parquet
    └── history/
```

---

## Этап 1 — Интеграция генератора атак (DeepTeam) ✅

**Файлы:** `src/red_team/runner.py`, `src/red_team/attacks.py`, `src/red_team/judges.py`

- [x] Async model_callback (Anthropic + OpenRouter)
- [x] Поддержка 4 типов атак: PromptInjection, Roleplay, CrescendoJailbreaking, LinearJailbreaking
- [x] Поддержка 6 уязвимостей: PromptLeakage, PIILeakage, ExcessiveAgency, Toxicity, Bias, IllegalActivity
- [x] Custom judge presets через YAML (`judge_custom_presets:`)
- [x] `ignore_errors=True` для устойчивости при отказе модели

---

## Этап 2 — Сбор и трансформация данных (Data Layer) ✅

**Файлы:** `src/data/transformer.py`, `src/data/storage.py`, `src/data/eval_storage.py`

- [x] `transform_risk_assessment()` → typed `pd.DataFrame`
- [x] Parquet storage + история в `results/history/`
- [x] `list_scan_files()` для scan selector в дашборде
- [x] `eval_storage.py` — читает eval/results/ JSON файлы
- [x] `quality_score()` — взвешенный quality score 0–100

---

## Этап 3 — Интерфейс (Streamlit Dashboard) ✅

**Файлы:** `src/dashboard/unified_app.py`, `src/dashboard/app.py`, `src/dashboard/charts.py`, `src/dashboard/quality_charts.py`

- [x] Unified app: вкладки Безопасность + Качество + Сравнение + Логи
- [x] KPI-строка: Security Score, ASR, Quality Score
- [x] OWASP expander с ремедиацией
- [x] Кнопки PDF / Markdown / JSON экспорта

---

## Этап 4 — Автоматизация (CI/CD) ✅ (частично)

**Файлы:** `.github/workflows/redteam.yml`

- [x] GitHub Actions workflow создан
- [x] Ручной запуск (`workflow_dispatch`) работает
- [ ] Авто-запуск на push/PR/schedule — backlog

---

## Этап 5 — Клиентский отчёт (Report Generation) ✅

**Файлы:** `src/reports/generator.py`, `src/reports/pdf_export.py`, `src/reports/templates/`

- [x] `calculate_security_score(df)` — взвешенный score 0–100
- [x] Jinja2 HTML + WeasyPrint PDF
- [x] Markdown export (без системных зависимостей)

---

## Этап 6 — RAG Quality Evaluation ✅

**Файлы:** `eval/`, `src/data/eval_storage.py`, `src/dashboard/quality_charts.py`

- [x] deepeval метрики: AnswerRelevancy, Faithfulness
- [x] Top-K параметр для RAG экспериментов
- [x] Eval results хранятся в `eval/results/{timestamp}/`
- [x] Markdown report generation
- [x] Quality charts в unified дашборде

---

## Этап 7 — Web Frontend (Next.js) ✅

**Файлы:** `web/`

- [x] Страницы: `/` (overview), `/redteam`, `/runner`, `/eval`
- [x] API routes: `/api/runner/redteam`, `/api/eval`, `/api/data`, `/api/run`
- [x] Компоненты: DashboardCharts, DatasetUpload, LogsTable, ExportActions, ComparisonTab

---

## Зависимости

```
# requirements.txt (ключевые)
deepteam==1.0.6
deepeval==3.9.3
anthropic==0.86.0
openai==2.30.0
pandas==2.3.3
pyarrow==23.0.1
streamlit==1.55.0
plotly==6.6.0
pydantic==2.12.5
pyyaml>=6.0
python-dotenv==1.2.2
jinja2>=3.1.0
weasyprint>=62.0
httpx>=0.28.0
gigachat
```

**Требования к Python:** 3.11+

---

## Переменные окружения

| Переменная | Обязательная | Описание |
|------------|-------------|----------|
| `ANTHROPIC_API_KEY` | Да (для Anthropic-таргетов) | API ключ Anthropic |
| `OPENROUTER_API_KEY` | Да (для OpenRouter-таргетов и judge) | API ключ OpenRouter |
| `OPENAI_API_KEY` | Нет | Опционально для OpenAI judge |
| `ASR_THRESHOLD` | Нет (default: 0.20) | Порог провала CI |
| `RESULTS_DIR` | Нет (default: ./results) | Директория red team результатов |
| `EVAL_RESULTS_DIR` | Нет (default: ./eval/results) | Директория eval результатов |
| `OPENROUTER_BASE_URL` | Нет | Override OpenRouter base URL |
