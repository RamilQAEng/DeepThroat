# Phase 1: Python Pipeline — Pattern Map

**Mapped:** 2026-04-17
**Files analyzed:** 4 (новых/изменяемых файлов)
**Analogs found:** 4 / 4

## File Classification

| Новый/изменяемый файл | Роль | Data Flow | Ближайший аналог | Качество совпадения |
|---|---|---|---|---|
| `eval/eval_ragas_metrics.py` | service/pipeline | batch, transform | `eval/eval_rag_metrics.py` | exact |
| `eval/custom_metrics/__init__.py` | module-init | — | `eval/scripts/__init__.py` | role-match |
| `eval/custom_metrics/example_metric.py` | utility | transform | `eval/eval_rag_metrics.py` (паттерн базового класса судьи) | partial |
| `requirements.txt` | config | — | `requirements.txt` (текущий) | exact |

---

## Pattern Assignments

### `eval/eval_ragas_metrics.py` (service/pipeline, batch)

**Аналог:** `eval/eval_rag_metrics.py`

**Паттерн импортов** (строки 1–39):
```python
"""
Pipeline: RAGAS metrics evaluation
===================================
Запуск (из папки eval/):
  python eval_ragas_metrics.py ../datasets/my_dataset.json

Настройка: скопируй .env.example → .env и заполни нужные поля.
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv

# Загружаем .env из папки скрипта — ТОЧНО КАК В АНАЛОГЕ
load_dotenv(Path(__file__).parent / ".env")

from ragas import evaluate, EvaluationDataset
from ragas.dataset_schema import SingleTurnSample
from ragas.metrics import Faithfulness, AnswerRelevancy, ContextPrecision, ContextRecall
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
```

**Паттерн конфигурации верхнего уровня** (строки 45–65 аналога):
```python
# ── Конфигурация ──────────────────────────────────────────────────────────────

JUDGE_PROVIDER   = os.getenv("JUDGE_PROVIDER", "openai").lower()
JUDGE_MODEL_NAME = os.getenv("JUDGE_MODEL", "gpt-4o-mini")
MAX_WORKERS      = 3        # RunConfig для ragas (не ThreadPoolExecutor)
LIMIT            = None     # если задан — обрабатывать только первые N записей
ERRORS_LOG: list = []

# Результаты сохраняются в eval/results/ с суффиксом _ragas
OUTPUT_DIR = Path(__file__).parent / "results"
OUTPUT_DIR.mkdir(exist_ok=True)
```

**Паттерн построения LLM judge** (строки 139–153 аналога — функция `build_judge`):
```python
def build_judge() -> LangchainLLMWrapper:
    """Создаёт RAGAS-совместимый LLM judge по JUDGE_PROVIDER из .env."""
    if JUDGE_PROVIDER == "openai":
        from langchain_openai import ChatOpenAI
        return LangchainLLMWrapper(ChatOpenAI(
            model=JUDGE_MODEL_NAME,
            api_key=os.environ["OPENAI_API_KEY"],
            base_url=os.getenv("OPENAI_BASE_URL"),  # прокси/OpenRouter-совместимый
        ))
    elif JUDGE_PROVIDER == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return LangchainLLMWrapper(ChatAnthropic(
            model=JUDGE_MODEL_NAME,
            api_key=os.environ["ANTHROPIC_API_KEY"],
        ))
    else:
        raise ValueError(f"Неизвестный JUDGE_PROVIDER: {JUDGE_PROVIDER}")
```

**Паттерн загрузки и конвертации датасета** (аналог строк 627–645 — начало `main()`):
```python
def load_dataset(path: Path) -> EvaluationDataset:
    """Загружает JSON и конвертирует в EvaluationDataset для RAGAS.

    Маппинг полей:
        question / user_query  → user_input
        actual_output / actual_answer → response
        retrieval_context (list) → retrieved_contexts
        expected_output / expected_answer → reference
    """
    with open(path, encoding="utf-8") as f:
        records = json.load(f)

    samples = []
    for rec in records:
        user_input = rec.get("question") or rec.get("user_query", "")
        response   = rec.get("actual_output") or rec.get("actual_answer", "")
        contexts   = rec.get("retrieval_context") or []
        reference  = rec.get("expected_output") or rec.get("expected_answer") or ""

        if not user_input or not response:
            continue  # пропускаем невалидные — аналогично evaluate_record в аналоге

        samples.append(SingleTurnSample(
            user_input=user_input,
            response=response,
            retrieved_contexts=contexts if isinstance(contexts, list) else [],
            reference=reference or None,
        ))

    return EvaluationDataset(samples=samples)
```

**Паттерн graceful-пропуска метрик при отсутствии контекста** (строки 497–558 аналога):
```python
def select_metrics(dataset: EvaluationDataset) -> list:
    """Выбирает метрики в зависимости от наличия контекста и reference.

    Копирует логику аналога: если нет retrieval_context — пропустить
    контекстные метрики (ContextPrecision, ContextRecall, Faithfulness).
    """
    has_context  = any(s.retrieved_contexts for s in dataset.samples)
    has_reference = any(s.reference for s in dataset.samples)

    metrics = [AnswerRelevancy()]  # всегда

    if has_context:
        metrics.append(Faithfulness())
    if has_context and has_reference:
        metrics.extend([ContextPrecision(), ContextRecall()])

    return metrics
```

**Паттерн вызова evaluate + сохранение результатов** (строки 688–710 аналога):
```python
async def run_pipeline(input_path: str) -> None:
    path = Path(input_path)
    if not path.exists():
        print(f"Файл не найден: {path}")
        sys.exit(1)

    dataset = load_dataset(path)
    llm      = build_judge()
    embeddings = LangchainEmbeddingsWrapper(
        OpenAIEmbeddings(model="text-embedding-3-small")
    )

    from ragas import RunConfig
    run_config = RunConfig(max_workers=MAX_WORKERS, max_wait=120)

    metrics = select_metrics(dataset)

    result = evaluate(
        dataset=dataset,
        metrics=metrics,
        llm=llm,
        embeddings=embeddings,
        run_config=run_config,
        raise_exceptions=False,  # не падать при ошибке одной метрики
    )

    # Сохранение — суффикс _ragas чтобы отличать от DeepEval папок
    stem = path.stem
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = OUTPUT_DIR / f"{ts}_{stem}_ragas"
    run_dir.mkdir(parents=True, exist_ok=True)

    # Конвертируем в формат совместимый с DeepEval (те же поля)
    rows = result.to_pandas().to_dict(orient="records")
    detail_json = run_dir / "metrics.json"
    with open(detail_json, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(f"Папка прогона → {run_dir}")
```

**Паттерн asyncio entry point** (строка 788 аналога + pitfall из PITFALLS.md):
```python
# ── Entry point ───────────────────────────────────────────────────────────────

def main(input_path: str) -> None:
    import sys
    # macOS asyncio pitfall из PITFALLS.md #2
    if sys.platform == "darwin":
        asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())
    asyncio.run(run_pipeline(input_path))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Использование: python eval_ragas_metrics.py <путь_к_файлу.json>")
        sys.exit(1)
    main(sys.argv[1])
```

**Паттерн обработки ошибок** (строки 530–585 аналога):
```python
# Аналог обёртывает каждую метрику в try/except и логирует в ERRORS_LOG:
try:
    result = evaluate(...)
except Exception as e:
    ERRORS_LOG.append({"error": str(e), "stage": "evaluate"})
    print(f"[ERROR] evaluate: {e}")

# raise_exceptions=False в evaluate() — RAGAS не падает при ошибке одной метрики
# NaN-значения в результатах — нормальная ситуация, обрабатывать gracefully
```

---

### `eval/custom_metrics/__init__.py` (module-init)

**Аналог:** `eval/scripts/__init__.py` (пустой файл — маркер модуля)

**Паттерн** (строка 1 аналога — пустой файл):
```python
# Пустой файл — маркер Python-пакета.
# Экспортировать кастомные метрики для удобного импорта:
# from eval.custom_metrics import MyCustomMetric
```

Точный паттерн: файл содержит только `__all__` или пустой, как в `eval/scripts/__init__.py`.

---

### `eval/custom_metrics/example_metric.py` (utility, transform)

**Аналог частичный:** паттерн класса `OpenRouterJudge(DeepEvalBaseLLM)` из `eval/eval_rag_metrics.py` строки 70–103 — структура базового класса с методами `get_model_name`, `load_model`, `generate`, `a_generate`.

Для RAGAS кастомная метрика наследует от `ragas.metrics.base.MetricWithLLM`:

**Паттерн кастомной метрики RAGAS** (на основе структуры базовых классов DeepEval из аналога + документация RAGAS):
```python
"""
Пример кастомной метрики для RAGAS.
Копировать этот файл для создания новых метрик.

Паттерн аналогичен кастомным судьям в eval_rag_metrics.py (строки 70-103):
  - Наследование от базового класса фреймворка
  - Обязательные методы name и _score
  - Документация параметров и ожидаемого диапазона значений
"""

from dataclasses import dataclass, field
from ragas.metrics.base import SingleTurnMetric
from ragas.dataset_schema import SingleTurnSample


@dataclass
class ExampleCustomMetric(SingleTurnMetric):
    """Пример кастомной метрики.

    Вычисляет: <описание метрики>.
    Диапазон: 0.0–1.0.
    Требования: user_input, response (+ опционально retrieved_contexts).
    """

    name: str = "example_custom_metric"
    # Порог pass/fail — аналог THRESHOLD_AR/FA в eval_rag_metrics.py
    threshold: float = 0.5

    async def _ascore(self, row: SingleTurnSample, callbacks=None) -> float:
        """Возвращает score в диапазоне 0.0–1.0."""
        # TODO: реализовать логику метрики
        # row.user_input      — вопрос
        # row.response        — ответ модели
        # row.retrieved_contexts — чанки (может быть None)
        # row.reference       — ground truth (может быть None)
        raise NotImplementedError("Реализуйте _ascore")
```

---

### `requirements.txt` (config)

**Аналог:** `/requirements.txt` (текущий файл проекта)

**Текущее содержимое** (строки 1–18):
```
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
pytest>=8.0.0
pytest-asyncio>=0.23.0
gigachat
httpx>=0.28.0
```

**Добавить в конец** (из STACK.md — таблица зависимостей):
```
ragas>=0.2.0
langchain-openai>=0.1.0
langchain-core>=0.2.0
```

**Примечание:** НЕ добавлять `langchain` (монолит) — только `langchain-openai` и `langchain-core`. Конфликт описан в PITFALLS.md пункт 1.

---

## Shared Patterns

### Загрузка .env
**Источник:** `eval/eval_rag_metrics.py` строка 39
**Применять к:** `eval/eval_ragas_metrics.py`
```python
load_dotenv(Path(__file__).parent / ".env")
```
Всегда относительно директории скрипта, не `os.getcwd()`.

### Именование папок результатов
**Источник:** `eval/eval_rag_metrics.py` строки 638–641, ARCHITECTURE.md
**Применять к:** `eval/eval_ragas_metrics.py`
```python
# DeepEval: {timestamp}_{stem}/
# RAGAS:    {timestamp}_{stem}_ragas/   ← суффикс _ragas обязателен
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
run_dir = OUTPUT_DIR / f"{ts}_{stem}_ragas"
```
Суффикс `_ragas` отличает папки от DeepEval — нужен для API route фильтрации (PITFALLS.md пункт 8).

### Graceful-пропуск метрик при отсутствии полей
**Источник:** `eval/eval_rag_metrics.py` строки 497–586
**Применять к:** `eval/eval_ragas_metrics.py` (функция `select_metrics`)
```python
# Паттерн из аналога: проверить наличие данных ПЕРЕД созданием метрики
has_context = isinstance(context, list) and len(context) > 0
has_expected = bool(expected)

# Контекстные метрики только если есть контекст
if has_context and "FA" in enabled_metrics:
    ...
```

### Формат выходного metrics.json
**Источник:** ARCHITECTURE.md (раздел "Выходные данные"), `eval/eval_rag_metrics.py` строки 595–616
**Применять к:** `eval/eval_ragas_metrics.py`

Поля результирующего JSON должны совпадать с полями DeepEval для совместимости UI:
```json
{
  "session_id": "...",
  "category": "...",
  "intent": "...",
  "user_query": "...",
  "actual_answer": "...",
  "expected_answer": "...",
  "faithfulness_score": 0.85,
  "answer_relevancy_score": 0.92,
  "context_precision_score": 0.78,
  "context_recall_score": 0.91
}
```
RAGAS возвращает DataFrame через `result.to_pandas()` — поля нужно переименовать под этот формат.

### asyncio macOS pitfall
**Источник:** PITFALLS.md пункт 2
**Применять к:** `eval/eval_ragas_metrics.py`
```python
import sys
if sys.platform == "darwin":
    asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())
asyncio.run(main_async())
```

### RunConfig для rate limiting
**Источник:** PITFALLS.md пункт 6
**Применять к:** `eval/eval_ragas_metrics.py`
```python
from ragas import RunConfig
run_config = RunConfig(max_workers=2, max_wait=120)
result = evaluate(dataset, metrics=..., run_config=run_config)
```

---

## No Analog Found

Файлов без аналога нет — все 4 файла имеют прямые или частичные аналоги в кодовой базе.

---

## Metadata

**Scope поиска аналогов:** `eval/`, корень проекта
**Файлов просканировано:** 6 (`eval_rag_metrics.py`, `scripts/run_eval.py`, `scripts/convert_dataset.py`, `scripts/__init__.py`, `requirements.txt`, `eval/CLAUDE.md`)
**Дата маппинга:** 2026-04-17
