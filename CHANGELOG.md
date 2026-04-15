# Changelog

Все значимые изменения в проекте DeepThroath документируются в этом файле.

## [Unreleased] - 2026-04-15 (Unified API Runner: RAG Eval + Red Teaming)

### 🚀 Отличительные фичи к добавлению (Features)
-  **Unified API Runner Dashboard (Убер-Раннер)**
    - Добавлена новая страница `/runner` в Next.js дашборд с двумя режимами работы через табы:
      - **Evaluate RAG**: Оценка качества RAG-систем с выбором метрик (AR, FA, CP, CR) и лимитом датасета
      - **Red Teaming**: Тестирование безопасности LLM с настройкой количества атак и порога успеха (ASR Threshold)
    - Реализована единая форма "API Contract" для обоих режимов: поддержка кастомного URL, Method, Headers и тела запроса с шорткодами (`{{user_query}}`, `{{category}}`).
    - Умные Extractors для парсинга ответов API по вложенным путям (напр. `data.answer`, `retrieved_chunks`).
    - **Drag & Drop загрузка датасетов**: Добавлен компонент для загрузки CSV/JSONL файлов через drag & drop с валидацией и preview
    - **Улучшенная визуальная иерархия**: Увеличены отступы, размеры шрифтов и spacing для более комфортного восприятия
- **Python Backend Integration**
    - В `run_eval.py` добавлена флаговая опция CLI `--dynamic-api-config` для RAG Evaluation через API контракт.
    - В `run_redteam.py` добавлена поддержка `--dynamic-api-config` для Red Teaming атак через HTTP callback.
    - В `src/red_team/runner.py` реализован `create_http_callback()` для асинхронной отправки атак на произвольные API.
- **API Routes**
    - `/api/runner` - запуск RAG Evaluation с динамическим API контрактом
    - `/api/runner/redteam` - запуск Red Teaming сканирования с поддержкой параметров `attacks_per_vulnerability` и `threshold`

### 🏗 Изменения инфраструктуры (Infrastructure & DevOps)
- **Унификация Venv**
    - Полностью устранена проблема работы с двумя разными окружениями (в `eval/` и `src/`).
    - Все зависимости перенесены в корневой `requirements.txt`.
    - Документация в `README.md` обновлена под один единый подход активации окружения.

### 🧹 Исправления багов (Bugfixes)
- Пофикшен критический баг, из-за которого Python процесс "проглатывал" вопросы без ошибки (return Code 0), если не был передан старый флаг `--api-url`, а передавался новый `API_CONFIG`.
- Добавлен недостающий секрет окружения `OPENROUTER_API_KEY` в CI/CD пайплайн на GitHub Actions (`redteam.yml`), чтобы устранить падение тестов при пуше или PR в `main`.
- **UI:** Исправлен баг в Tailwind v4, из-за которого слетал фирменный шрифт (Inter) и подставлялся дефолтный шрифт с засечками (serif).
- **UI:** Внедрены Full-screen Empty States (стартовые заглушки приветствия) для главной страницы и отчетов RAG, чтобы скрыть "красные" ошибки при полном отсутствии данных в системе.
