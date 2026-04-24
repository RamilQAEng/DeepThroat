# USER COMMANDS — DeepThroath

Справочник по запуску всех скриптов и прогонов платформы.

---

## 0. Подготовка окружения

```bash
# Установить Python-зависимости (из корня проекта)
pip install -r requirements.txt

# Создать .env в корне проекта (обязательно)
cp .env.example .env   # отредактировать ключи

# Обязательные переменные в .env:
OPENROUTER_API_KEY=sk-or-...      # для judge-моделей через OpenRouter
OPENAI_API_KEY=sk-...             # если используешь OpenAI напрямую
ANTHROPIC_API_KEY=sk-ant-...      # для Red Team через Anthropic
RAG_API_BASE_URL=https://assist.dev.mglk.ru   # URL живого RAG-бота (онлайн-режим)
```

---

## 1. RAG Evaluation (DeepEval)

### 1.1 Оффлайн-прогон (быстро, без вызова бота)

Использует готовые ответы и чанки из файла `offline_ready_full.json`.

```bash
# Базовый прогон — судья по умолчанию (gpt4o-mini-or)
python eval/scripts/run_eval.py --input eval/datasets/offline_ready_full.json

# Выбрать конкретного судью
python eval/scripts/run_eval.py \
    --input eval/datasets/offline_ready_full.json \
    --judge qwen-72b-or

# Быстрая проверка — только первые 10 записей
python eval/scripts/run_eval.py \
    --input eval/datasets/offline_ready_full.json \
    --judge deepseek-v3 \
    --limit 10

# Уменьшить параллелизм (если туннель нестабильный)
python eval/scripts/run_eval.py \
    --input eval/datasets/offline_ready_full.json \
    --workers 2
```

### 1.2 Онлайн-прогон (вызывает живой бот, получает свежие ответы)

```bash
# Используется URL по умолчанию из RAG_API_BASE_URL
python eval/scripts/run_eval.py \
    --input eval/datasets/20260422_deep_eval_quality_dataset.json \
    --online

# Указать URL явно
python eval/scripts/run_eval.py \
    --input eval/datasets/20260422_deep_eval_quality_dataset.json \
    --online \
    --api-url https://assist.dev.mglk.ru
```

После онлайн-прогона в директории результатов появится `api_responses.json` — его можно переиспользовать для оффлайн-пересчёта.

### 1.3 Доступные судьи (judge)

| Ключ | Модель | Рекомендация |
|---|---|---|
| `gpt4o-mini-or` | GPT-4o-mini | Быстрый, дешёвый |
| `gpt4o-or` | GPT-4o | Точный |
| `deepseek-v3` | DeepSeek V3.2 | Высокое качество |
| `qwen-72b-or` | Qwen2.5 72B | Оптимум качество/цена |
| `qwen-235b-or` | Qwen3 235B | Максимальное качество |
| `qwq-32b-or` | QwQ-32B | Аналитический |
| `gemini-flash` | Gemini Flash | Дешёвый |
| `local-qwen` | Qwen 35B (туннель) | Локальный, без внешних затрат |

### 1.4 Результаты прогона

```
eval/results/{timestamp}_{dataset_name}/
├── metrics.json        # Все метрики по каждому тест-кейсу
├── metrics.csv         # То же в CSV
├── report.md           # Полный MD-отчёт (2700+ строк)
├── api_responses.json  # Ответы бота (только онлайн-режим)
└── errors_log.json     # Ошибки судьи (если были)
```

---

## 2. Предобработка данных

### 2.1 Очистить ответы бота от CTA-фраз

Нужно перед оффлайн-пересчётом, если ответы содержат "Чем ещё могу помочь?".

```bash
python eval/scripts/strip_cta.py \
    eval/results/<run_dir>/api_responses.json
# Создаёт: eval/results/<run_dir>/<timestamp>_stripped_dataset.json

# Затем запустить оффлайн-прогон на очищенных данных:
python eval/scripts/run_eval.py \
    --input eval/results/<run_dir>/<timestamp>_stripped_dataset.json \
    --judge qwen-72b-or
```

### 2.2 Вспомогательные скрипты (папка `scratch/`)

```bash
# Синхронизировать Ground Truth между датасетами
python scratch/sync_expected_answers.py

# Восстановить датасет из сырых API-логов
python scratch/reconstruct_dataset.py

# Конвертировать логи в формат для оффлайн-пересчёта
python scratch/fix_api_responses.py

# Объединить несколько датасетов в один
python scratch/merge_datasets.py
```

---

## 3. Red Teaming (DeepTeam)

### 3.1 Запуск через CLI (из корня проекта)

```bash
# Базовый запуск — конфиг по умолчанию
python scripts/run_redteam.py \
    --target default \
    --config config/attack_config.yaml

# Указать конкретную модель-цель
python scripts/run_redteam.py \
    --target default \
    --model anthropic:claude-sonnet-4-6

# Использовать OpenRouter провайдер
python scripts/run_redteam.py \
    --target default \
    --model openrouter:openai/gpt-4o

# Задать судью для оценки атак
python scripts/run_redteam.py \
    --target default \
    --judge gpt4o-or

# Атаковать живой HTTP API (кастомный api-config)
python scripts/run_redteam.py \
    --target default \
    --dynamic-api-config path/to/api_contract.json
```

### 3.2 Аргументы run_redteam.py

| Аргумент | По умолчанию | Описание |
|---|---|---|
| `--target` | `default` | Цель из `config/targets.yaml` |
| `--config` | `config/attack_config.yaml` | Конфиг атак и уязвимостей |
| `--model` | из конфига | Переопределить модель-цель |
| `--judge` | deepeval default | Модель-судья для оценки |
| `--output` | `results/` | Директория для сохранения |
| `--dynamic-api-config` | — | JSON с HTTP API контрактом |

### 3.3 Результаты Red Team

```
results/{timestamp}_{model}/
└── results.parquet     # Результаты атак (ASR по уязвимостям)
```

**ASR (Attack Success Rate)** — процент успешных атак. Порог: `< 20%` = PASS.

---

## 4. FastAPI Backend

### 4.1 Запуск сервера

```bash
# Из корня проекта
uvicorn src.api.main:app --reload --port 8000

# Проверка что работает
curl http://localhost:8000/docs   # Swagger UI
```

### 4.2 API Endpoints

| Endpoint | Метод | Описание |
|---|---|---|
| `POST /api/runner/redteam` | POST | Запустить Red Team (фон) |
| `POST /api/runner/eval` | POST | Запустить RAG Eval (фон) |
| `GET /api/jobs/{job_id}/status` | GET | Статус задачи |

---

## 5. Next.js Frontend

```bash
cd web
npm install
npm run dev     # http://localhost:3000
```

**Требует запущенного FastAPI** на `localhost:8000` для работы прогонов.

---

## 6. Типичные рабочие сценарии

### Быстрая проверка метрик после правки датасета

```bash
python eval/scripts/run_eval.py \
    --input eval/datasets/offline_ready_full.json \
    --judge qwen-72b-or \
    --limit 20
```

### Полный оффлайн-прогон с максимальным качеством

```bash
python eval/scripts/run_eval.py \
    --input eval/datasets/offline_ready_full.json \
    --judge qwen-235b-or \
    --workers 3
```

### Онлайн → очистка → пересчёт

```bash
# 1. Получить свежие ответы от бота
python eval/scripts/run_eval.py \
    --input eval/datasets/20260422_deep_eval_quality_dataset.json \
    --online

# 2. Очистить от CTA
python eval/scripts/strip_cta.py \
    eval/results/<run_dir>/api_responses.json

# 3. Пересчитать метрики на чистых данных
python eval/scripts/run_eval.py \
    --input eval/results/<run_dir>/<timestamp>_stripped_dataset.json \
    --judge deepseek-v3
```

### Red Team скан + проверка ASR

```bash
python scripts/run_redteam.py \
    --target default \
    --judge gpt4o-or
# ASR < 20% → PASS, иначе FAIL (exit code 1)
```
