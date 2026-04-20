# DeepThroath v2 — Features Summary

Реализованные коммерческие фичи поверх RAGAS-интеграции.
Каждая фича — отдельная ветка, ветки цепочкой: `feat/ragas-eval` → `feat/scan-comparison` → `feat/scheduled-runs` → `feat/pdf-report` → `feat/provider-comparison`.

---

## Фича 1 — Scan Comparison (A/B Delta)
**Ветка:** `feat/scan-comparison`

Сравнение двух прогонов: дельта по каждой метрике, победитель, постройчная diff-таблица.

### Что добавлено
- `web/src/app/api/eval/compare/route.ts` — GET `/api/eval/compare?scan1=X&scan2=Y`
- `web/src/components/EvalDeepEvalTab.tsx` — вкладка «Сравнение» с DeltaBadge

### Ручная проверка
```bash
# 1. Открыть http://localhost:3000/eval → вкладка DeepEval
# 2. Перейти на вкладку «Сравнение»
# 3. Выбрать два прогона из дропдаунов → нажать «Сравнить»
# 4. Должна появиться таблица с колонками Δ и цветовой индикацией

# Или через curl:
curl "http://localhost:3000/api/eval/compare?scan1=<папка1>&scan2=<папка2>"
```

---

## Фича 2 — CI/CD Quality Gate (`--fail-below`)
**Ветка:** `feat/scan-comparison`

Автоматический quality gate: если avg метрики ниже порога — exit code 1, CI падает.

### Что добавлено
- `eval/eval_ragas_metrics.py` — флаг `--fail-below=0.70`, `sys.exit(1)` при провале
- `eval/eval_rag_metrics.py` — то же самое для DeepEval
- `.github/workflows/rag-quality-gate.yml` — два job'а (RAGAS + DeepEval), артефакты 30 дней

### Ручная проверка
```bash
# RAGAS — должен напечатать [QUALITY GATE PASSED/FAILED] и вернуть код
cd eval
python eval_ragas_metrics.py datasets/dataset.json --fail-below=0.70 --limit=3
echo "Exit code: $?"

# DeepEval
python eval_rag_metrics.py datasets/dataset.json --fail-below=0.70
echo "Exit code: $?"

# GitHub Actions — запустить вручную:
# GitHub → Actions → RAG Quality Gate → Run workflow
```

---

## Фича 3 — Scheduled Runs + Telegram Notifications
**Ветка:** `feat/scheduled-runs`

Крон-планировщик запускает eval по расписанию и шлёт результаты в Telegram.

### Что добавлено
- `scripts/scheduler.py` — async scheduler (croniter), subprocess runner, httpx Telegram
- `config/scheduler.yaml` — расписание, порог, настройки уведомлений

### Конфиг
```yaml
# config/scheduler.yaml
schedule: "0 9 * * *"   # каждый день в 09:00
fail_below: 0.70
notifications:
  telegram:
    enabled: true
    on_failure: true
    on_success: true
```

### Переменные окружения (`.env`)
```bash
TELEGRAM_BOT_TOKEN=1234567890:AAF...   # от @BotFather
TELEGRAM_CHAT_ID=-100xxxxxxxxx         # от @userinfobot
```

### Ручная проверка
```bash
# Тест Telegram — отправляет сообщение с фейковыми метриками
python scripts/test_telegram.py

# Запустить eval прямо сейчас (не ждать крона)
python scripts/scheduler.py --run-now

# Запустить с лимитом 3 записи для быстрой проверки
python scripts/scheduler.py --run-now --limit=3

# Запустить планировщик (блокирующий, держи в фоне)
python scripts/scheduler.py

# Тест через API (если запущен Next.js)
curl -X POST http://localhost:3000/api/eval/notify-test
```

### Формат Telegram-сообщения
```
✅ RAG Quality Gate — PASSED
📅 21.04.2026 09:00
🔬 Framework: RAGAS
📂 Dataset: dataset.json
⚡ Duration: 87s

📊 Метрики:
  ✓ Answer Relevancy: 82.4%
  ✓ Faithfulness: 78.1%
  ✗ Ctx Precision: 61.3%
  Порог: 70%

📁 20260421_090000_..._ragas
```

---

## Фича 4 — Branded PDF Report
**Ветка:** `feat/pdf-report`

Генерация брендированного PDF-отчёта из результатов прогона (WeasyPrint + Jinja2).

### Что добавлено
- `eval/export_pdf.py` — CLI + функция `export_pdf(results_dir, out_path, fail_below)`
- `eval/templates/rag_report.html` — шаблон: обложка, KPI, таблица метрик, построчные данные
- `eval/templates/rag_report.css` — светлый минималистичный стиль
- `web/src/app/api/eval/export-pdf/route.ts` — GET `/api/eval/export-pdf?scan=<dir>`
- `web/src/app/api/eval/notify-test/route.ts` — POST `/api/eval/notify-test`
- `scripts/test_telegram.py` — ручной тест Telegram
- `EvalRagasTab.tsx` — кнопка «Export PDF» рядом с дропдауном прогонов

### Ручная проверка
```bash
# Из командной строки — сгенерировать PDF из последнего RAGAS-прогона
LATEST=$(ls eval/results/ | grep ragas | tail -1)
python eval/export_pdf.py "eval/results/$LATEST" --out report.pdf
open report.pdf   # macOS

# С кастомным порогом
python eval/export_pdf.py "eval/results/$LATEST" --fail-below=0.75 --out report.pdf

# Через браузер
# http://localhost:3000/eval → вкладка RAGAS → кнопка «Export PDF» → файл скачается

# Через curl
SCAN="20260418_185232_20260413_115154_20260329_173829_exp_top_k_10_dataset_ragas"
curl "http://localhost:3000/api/eval/export-pdf?scan=$SCAN" -o report.pdf
open report.pdf
```

### Структура PDF
| Раздел | Содержимое |
|--------|-----------|
| Обложка | Название, датасет, overall avg%, дата, кол-во записей |
| 1. Резюме | KPI-карточки по каждой метрике + Quality Gate badge |
| 2. Метрики | Таблица avg/min/max + прогресс-бар + Pass/Warn/Fail |
| 3. Детали | Построчная таблица всех записей с оценками |

---

## Фича 5 — Provider Comparison Dashboard
**Ветка:** `feat/provider-comparison`

Сравнение нескольких LLM-судей на одном датасете: какой провайдер даёт более высокие/низкие оценки, где расхождения.

### Что добавлено
- `eval/eval_ragas_metrics.py` — флаг `--judge <alias>` переопределяет судью из `targets.yaml`, тегирует папку прогона и сохраняет `meta.json` с метаданными судьи
- `eval/run_provider_comparison.py` — запускает eval параллельно для нескольких судей, печатает ASCII-таблицу сравнения, сохраняет `eval/results/provider_comparison_<dataset>.json`
- `web/src/app/api/eval/providers/route.ts` — GET `/api/eval/providers`, группирует все прогоны с `meta.json` по судье, возвращает avg метрик
- `EvalRagasTab.tsx` — коллапсируемая секция «Сравнение провайдеров» внизу страницы, лениво загружается при раскрытии, показывает таблицу с подсветкой лучшего судьи (★)

### Ручная проверка
```bash
# Посмотреть доступных судей
python eval/run_provider_comparison.py --list-judges

# Запустить сравнение 2 судей с лимитом 3 записи
python eval/run_provider_comparison.py eval/datasets/dataset.json \
  --judges gpt4o-mini-or,qwen-72b-or \
  --limit 3

# Запустить один прогон с конкретным судьёй
python eval/eval_ragas_metrics.py eval/datasets/dataset.json \
  --judge gpt4o-mini-or --limit 3

# API — посмотреть все теги провайдеров
curl http://localhost:3000/api/eval/providers | python3 -m json.tool

# Фронт
# http://localhost:3000/eval → вкладка RAGAS → прокрутить вниз
# → секция «Сравнение провайдеров» → раскрыть
# → таблица метрик по судьям, лучший отмечен ★
```

### Формат `meta.json` (создаётся в каждом прогоне с --judge)
```json
{
  "judge_name": "gpt4o-mini-or",
  "judge_model": "openai/gpt-4o-mini",
  "provider": "openrouter",
  "dataset": "/path/to/dataset.json",
  "timestamp": "20260421_090000",
  "total_records": 10
}
```

---

## Быстрый smoke-test всех фич

```bash
# 0. Убедиться что venv активирован и зависимости установлены
source .venv/bin/activate
pip install -r requirements.txt

# 1. Quality gate
cd eval && python eval_ragas_metrics.py datasets/dataset.json --fail-below=0.70 --limit=3
echo "Gate exit: $?"

# 2. PDF
LATEST=$(ls results/ | grep ragas | tail -1)
python export_pdf.py "results/$LATEST" --out /tmp/smoke_report.pdf && echo "PDF OK"

# 3. Telegram
cd .. && python scripts/test_telegram.py

# 4. Scheduler (one-shot)
python scripts/scheduler.py --run-now --limit=3

# 5. Фронт
# Открыть http://localhost:3000/eval
# → вкладка RAGAS → кнопка Export PDF → файл скачался
# → вкладка DeepEval → подвкладка Сравнение → выбрать 2 прогона → Сравнить

# 6. Provider comparison
python eval/run_provider_comparison.py eval/datasets/dataset.json \
  --judges gpt4o-mini-or,qwen-72b-or --limit 3
# → вкладка RAGAS → секция «Сравнение провайдеров» → раскрыть → таблица с ★
```
