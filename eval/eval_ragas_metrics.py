"""
Pipeline: RAGAS metrics evaluation
===================================
Запуск (из корня проекта):

  # Режим 1: папка прогона DeepEval (читает api_responses.json — без вызова API)
  python eval/eval_ragas_metrics.py eval/results/<папка_прогона>/

  # Режим 2: исходный датасет JSON (вызывает RAG API для каждой записи)
  python eval/eval_ragas_metrics.py eval/datasets/<file>.json

Шаги:
  1. Читает данные (папка DeepEval или датасет JSON)
  2. Конвертирует в EvaluationDataset(SingleTurnSample) с маппингом:
       user_query -> user_input, actual_answer -> response,
       retrieved_chunks (list) -> retrieved_contexts, expected_answer -> reference
  3. Запускает ragas.evaluate() со стандартными метриками + автодискавери из
     eval/custom_metrics/
  4. Сохраняет в eval/results/{timestamp}_{stem}_ragas/metrics.json

Настройка: скопируй .env.example -> .env (или используй тот же .env что у DeepEval).
Переменные окружения: OPENAI_API_KEY, OPENAI_BASE_URL, JUDGE_PROVIDER, JUDGE_MODEL,
API_URL (опционально, только для режима 2).
"""

import os
import sys
import json
import asyncio
import importlib
import pkgutil
import warnings
from pathlib import Path
from datetime import datetime
from typing import Optional

import yaml
from dotenv import load_dotenv

# .env загружается ИЗ ПАПКИ СКРИПТА — паттерн из eval_rag_metrics.py:39
load_dotenv(Path(__file__).parent / ".env")

try:
    import httpx as _httpx
    _HAS_HTTPX = True
except ImportError:
    _HAS_HTTPX = False

from ragas import EvaluationDataset, evaluate, RunConfig
from ragas.dataset_schema import SingleTurnSample
from ragas.metrics import (
    Faithfulness, AnswerRelevancy, ContextPrecision,
    ContextRecall, AnswerCorrectness,
)
from ragas.metrics.base import MetricWithLLM, SingleTurnMetric
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

# ── Конфигурация верхнего уровня ──────────────────────────────────────────────

JUDGE_PROVIDER   = os.getenv("JUDGE_PROVIDER", "openai").lower()
JUDGE_MODEL_NAME = os.getenv("JUDGE_MODEL", "gpt-4o-mini")
EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "text-embedding-3-small")
MAX_WORKERS      = 3
MAX_WAIT         = 120
OUTPUT_DIR       = Path(__file__).parent / "results"
CONFIG_PATH      = Path(__file__).parent / "config" / "eval_config.yaml"
CUSTOM_METRICS_DIR = Path(__file__).parent / "custom_metrics"
OUTPUT_DIR.mkdir(exist_ok=True)


def load_eval_config() -> dict:
    """Читает eval/config/eval_config.yaml и возвращает dict конфигурации.

    Если файл не найден — возвращает {} с предупреждением.
    Если файл не парсится — выводит ошибку и завершает процесс.
    Поддерживаемые поля: max_workers, api (url/method/headers/body/extractors),
    metrics (флаги answer_relevancy, faithfulness и др.).
    """
    if not CONFIG_PATH.exists():
        warnings.warn(f"eval_config.yaml не найден: {CONFIG_PATH} — используются дефолты", UserWarning)
        return {}
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
        return cfg
    except yaml.YAMLError as e:
        print(f"[ERROR] Ошибка парсинга {CONFIG_PATH}: {e}")
        sys.exit(1)


def build_judge() -> LangchainLLMWrapper:
    """Создаёт LLM-судью по JUDGE_PROVIDER из .env.

    Поддерживаемые провайдеры: openai (по умолчанию), openrouter.
    Для openrouter использует OPENROUTER_API_KEY.
    Для openai использует OPENAI_API_KEY + опциональный OPENAI_BASE_URL.
    """
    if JUDGE_PROVIDER == "openrouter":
        llm = ChatOpenAI(
            model=JUDGE_MODEL_NAME,
            api_key=os.environ["OPENROUTER_API_KEY"],
            base_url="https://openrouter.ai/api/v1",
        )
    elif JUDGE_PROVIDER == "openai":
        llm = ChatOpenAI(
            model=JUDGE_MODEL_NAME,
            api_key=os.environ["OPENAI_API_KEY"],
            base_url=os.getenv("OPENAI_BASE_URL"),
        )
    else:
        raise ValueError(
            f"Неизвестный JUDGE_PROVIDER: '{JUDGE_PROVIDER}'. "
            "Поддерживаются: openai, openrouter"
        )
    return LangchainLLMWrapper(llm)


def build_embeddings() -> LangchainEmbeddingsWrapper:
    """OpenAIEmbeddings нужны для AnswerRelevancy (PITFALLS.md #4)."""
    return LangchainEmbeddingsWrapper(OpenAIEmbeddings(
        model=EMBEDDINGS_MODEL,
        api_key=os.environ["OPENAI_API_KEY"],
        base_url=os.getenv("OPENAI_BASE_URL"),
    ))


# ── Template utils (копия из eval_rag_metrics.py:338-368) ────────────────────

def get_value_by_path(data: dict, path: str, default=None):
    """Извлекает значение по 'a.b.c' — копия из eval_rag_metrics.py:338-352."""
    if not path:
        return default
    keys = path.split('.')
    val = data
    for k in keys:
        if isinstance(val, dict):
            val = val.get(k)
        elif isinstance(val, list) and k.isdigit():
            val = val[int(k)]
        else:
            return default
        if val is None:
            return default
    return val


def resolve_template(template, rec: dict):
    """Рекурсивная подстановка {{var}} — копия из eval_rag_metrics.py:354-368."""
    if isinstance(template, str):
        res = template
        for k, v in rec.items():
            if isinstance(v, str):
                res = res.replace(f"{{{{{k}}}}}", v)
        return res
    elif isinstance(template, dict):
        return {k: resolve_template(v, rec) for k, v in template.items()}
    elif isinstance(template, list):
        return [resolve_template(v, rec) for v in template]
    return template


def fetch_from_api(rec: dict, api_config: Optional[dict]) -> dict:
    """Вызывает RAG API для одной записи, возвращает обогащённый dict.

    Возвращает rec + поля: user_query, actual_answer, retrieval_context (list[str]).
    Если api_config None или пуст — использует API_URL env var как fallback.
    Если ни конфига, ни API_URL — поднимает RuntimeError.
    """
    if not _HAS_HTTPX:
        raise RuntimeError("httpx не установлен: pip install httpx")

    if api_config:
        config = api_config
    else:
        fallback_url = os.getenv("API_URL")
        if fallback_url:
            config = {
                "url": fallback_url,
                "method": "POST",
                "headers": {},
                "body": {"question": "{{user_query}}", "category": "{{category}}"},
                "extractors": {
                    "answer": "answer",
                    "chunks": "retrieved_chunks",
                },
            }
        else:
            raise RuntimeError(
                "API не настроен: добавь api в eval_config.yaml или установи API_URL env var"
            )

    question = rec.get("question") or rec.get("user_query", "")
    category = rec.get("category") or rec.get("intent", "")

    template_vars = dict(rec)
    template_vars["user_query"] = question
    template_vars["category"] = category

    url = config["url"]
    method = config.get("method", "POST").upper()
    headers = config.get("headers", {})
    body_template = config.get("body", {})
    payload = resolve_template(body_template, template_vars)

    with _httpx.Client(timeout=120.0, verify=False) as client:
        if method == "POST":
            resp = client.post(url, headers=headers, json=payload)
        elif method == "GET":
            resp = client.get(url, headers=headers, params=payload)
        else:
            raise ValueError(f"Неподдерживаемый HTTP-метод: {method}")

    if resp.status_code != 200:
        raise RuntimeError(f"API {resp.status_code} по адресу {url}: {resp.text[:200]}")

    try:
        data = resp.json()
    except Exception:
        raise RuntimeError(f"API вернул невалидный JSON: {resp.text[:200]}")

    ex_answer = config.get("extractors", {}).get("answer", "answer")
    ex_chunks = config.get("extractors", {}).get("chunks", "retrieved_chunks")

    answer = get_value_by_path(data, ex_answer, "")
    chunks_raw = get_value_by_path(data, ex_chunks, [])

    chunks_text: list[str] = []
    if isinstance(chunks_raw, list):
        for c in chunks_raw:
            if isinstance(c, str):
                chunks_text.append(c)
            elif isinstance(c, dict):
                if "content" in c:
                    chunks_text.append(c["content"])
                elif "text" in c:
                    chunks_text.append(c["text"])
                else:
                    chunks_text.append(str(c))
    else:
        chunks_text = [str(chunks_raw)]

    enriched = dict(rec)
    enriched["user_query"] = question
    enriched["actual_answer"] = answer
    enriched["retrieval_context"] = chunks_text
    return enriched


def load_from_deepeval_run(folder: Path) -> list[dict]:
    """Режим 1: читает готовый прогон DeepEval без вызова API.

    Из api_responses.json берёт: question, answer, retrieved_chunks (content).
    Из metrics.json берёт: expected_answer (join по id).
    """
    api_path = folder / "api_responses.json"
    metrics_path = folder / "metrics.json"

    if not api_path.exists():
        raise FileNotFoundError(f"api_responses.json не найден в {folder}")

    with open(api_path, encoding="utf-8") as f:
        api_rows = json.load(f)

    expected_by_id: dict = {}
    if metrics_path.exists():
        with open(metrics_path, encoding="utf-8") as f:
            for row in json.load(f):
                rid = row.get("id") or row.get("session_id")
                if rid:
                    expected_by_id[rid] = row.get("expected_answer")

    records = []
    for row in api_rows:
        rid = row.get("id")
        chunks_raw = row.get("retrieved_chunks", [])
        retrieval_context: list[str] = [
            c["content"] if isinstance(c, dict) else str(c)
            for c in chunks_raw
        ]
        records.append({
            "id": rid,
            "session_id": rid,
            "category": row.get("category"),
            "user_query": row.get("question") or row.get("user_query", ""),
            "actual_answer": row.get("answer") or row.get("actual_answer", ""),
            "expected_answer": expected_by_id.get(rid),
            "retrieval_context": retrieval_context,
        })
    print(f"[DeepEval run] Загружено {len(records)} записей из {folder.name}")
    return records


def load_and_enrich_records(path: Path, api_config: Optional[dict]) -> list[dict]:
    """Режим 2: читает датасет JSON, вызывает RAG API для каждой записи."""
    with open(path, encoding="utf-8") as f:
        records = json.load(f)
    enriched = []
    for i, rec in enumerate(records, 1):
        if "expected_output" in rec and "expected_answer" not in rec:
            rec = dict(rec, expected_answer=rec["expected_output"])
        try:
            enriched.append(fetch_from_api(rec, api_config))
            print(f"[{i}/{len(records)}] API OK: {rec.get('id', rec.get('session_id', '-'))}")
        except Exception as e:
            print(f"[{i}/{len(records)}] API ERROR: {e}")
    return enriched


def build_dataset(records: list[dict]) -> EvaluationDataset:
    """Конвертирует обогащённые записи в RAGAS EvaluationDataset.

    Маппинг полей:
      user_query      -> user_input   (обязательно)
      actual_answer   -> response     (обязательно, пустые записи пропускаются)
      retrieval_context (list) -> retrieved_contexts (нормализация None/str/list)
      expected_answer -> reference    (None если пусто)
    """
    samples = []
    for rec in records:
        uq = (rec.get("user_query") or "").strip()
        aa = (rec.get("actual_answer") or "").strip()
        if not uq or not aa:
            continue

        rc = rec.get("retrieval_context")
        if rc is None:
            retrieved_contexts: list[str] = []
        elif isinstance(rc, str):
            retrieved_contexts = [rc]
        else:
            retrieved_contexts = list(rc)

        reference = rec.get("expected_answer") or None

        samples.append(SingleTurnSample(
            user_input=uq,
            response=aa,
            retrieved_contexts=retrieved_contexts,
            reference=reference,
        ))
    return EvaluationDataset(samples=samples)


def discover_custom_metrics() -> list:
    """Автодискавери: сканирует eval/custom_metrics/*.py, возвращает инстансы
    подклассов MetricWithLLM+SingleTurnMetric.
    """
    if not CUSTOM_METRICS_DIR.exists():
        return []
    found = []
    try:
        import eval.custom_metrics as cm_pkg
    except ImportError as e:
        print(f"[WARN] Не удалось импортировать пакет eval.custom_metrics: {e}")
        return []
    for modinfo in pkgutil.iter_modules(cm_pkg.__path__):
        if modinfo.name.startswith("_"):
            continue
        try:
            mod = importlib.import_module(f"eval.custom_metrics.{modinfo.name}")
        except Exception as e:
            print(f"[WARN] Не удалось импортировать eval.custom_metrics.{modinfo.name}: {e}")
            continue
        for attr in dir(mod):
            cls = getattr(mod, attr)
            if not isinstance(cls, type):
                continue
            if cls is MetricWithLLM or cls is SingleTurnMetric:
                continue
            if issubclass(cls, MetricWithLLM) and issubclass(cls, SingleTurnMetric):
                try:
                    found.append(cls())
                    print(f"[+] Кастомная метрика: {cls.__name__}")
                except Exception as e:
                    print(f"[WARN] Не удалось инстанцировать {cls.__name__}: {e}")
    return found


def select_metrics(dataset: EvaluationDataset, enabled: Optional[dict] = None) -> list:
    """Выбирает список метрик на основе наличия контекста и reference.

    Логика graceful-пропуска (RAGAS-04):
    - AnswerRelevancy: всегда (не требует контекста или reference)
    - Faithfulness: только если есть retrieved_contexts
    - ContextPrecision, ContextRecall: только если есть и contexts, и reference
    - AnswerCorrectness: только если есть reference
    - Кастомные из eval/custom_metrics/: добавляются автодискавери
    """
    has_context = any(s.retrieved_contexts for s in dataset.samples)
    has_reference = any(s.reference for s in dataset.samples)

    metrics: list = [AnswerRelevancy()]

    if has_context:
        metrics.append(Faithfulness())
    else:
        warnings.warn(
            "retrieved_contexts пуст у всех записей — "
            "пропускаем Faithfulness, ContextPrecision, ContextRecall",
            UserWarning,
        )

    if has_context and has_reference:
        metrics.extend([ContextPrecision(), ContextRecall()])

    if has_reference:
        metrics.append(AnswerCorrectness())

    metrics.extend(discover_custom_metrics())
    return metrics


def save_results(records: list[dict], result, run_dir: Path) -> Path:
    """Сохраняет metrics.json в формате совместимом с DeepEval UI.

    Phase 2 (API route) читает этот файл.
    Поля: session_id, category, intent, user_query, actual_answer, expected_answer,
    retrieval_context + *_score поля для каждой метрики.
    NaN из pandas конвертируется в None (json.dump не поддерживает NaN).
    """
    df = result.to_pandas()
    scores_list = df.to_dict(orient="records")

    STANDARD_RAGAS_COLS = {
        "user_input", "response", "retrieved_contexts", "reference",
        "faithfulness", "answer_relevancy", "context_precision",
        "context_recall", "answer_correctness",
    }

    rows = []
    for rec, scores in zip(records, scores_list):
        row = {
            "session_id": rec.get("session_id") or rec.get("id"),
            "category": rec.get("category"),
            "intent": rec.get("intent"),
            "user_query": rec.get("user_query"),
            "actual_answer": rec.get("actual_answer"),
            "expected_answer": rec.get("expected_answer"),
            "retrieval_context": rec.get("retrieval_context") or [],
        }

        for ragas_key, out_key in [
            ("faithfulness",       "faithfulness_score"),
            ("answer_relevancy",   "answer_relevancy_score"),
            ("context_precision",  "context_precision_score"),
            ("context_recall",     "context_recall_score"),
            ("answer_correctness", "answer_correctness_score"),
        ]:
            val = scores.get(ragas_key)
            # NaN -> None: json.dump не поддерживает NaN
            if val is not None and (val != val):
                val = None
            row[out_key] = val

        # Кастомные метрики: все колонки вне стандартного набора
        for k, v in scores.items():
            if k in STANDARD_RAGAS_COLS:
                continue
            if v is not None and (v != v):
                v = None
            row[f"{k}_score"] = v

        rows.append(row)

    out_path = run_dir / "metrics.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    return out_path


# ── Asyncio entry point ───────────────────────────────────────────────────────

def _apply_asyncio_policy() -> None:
    """Фикс для macOS: предотвращает 'event loop is already running' (PITFALLS.md #2)."""
    if sys.platform == "darwin":
        asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())


async def run_pipeline(path: Path, limit: Optional[int] = None) -> None:
    """Основной async пайплайн RAGAS-оценки."""
    config = load_eval_config()

    is_deepeval_run = path.is_dir()
    print(f"Режим        : {'DeepEval run (без API)' if is_deepeval_run else 'датасет JSON (с API)'}")
    print(f"Входной путь : {path}")
    print(f"Судья        : {JUDGE_PROVIDER} / {JUDGE_MODEL_NAME}")
    print(f"Embeddings   : {EMBEDDINGS_MODEL}")

    # 1. Загрузка записей
    if is_deepeval_run:
        records = load_from_deepeval_run(path)
    else:
        records = load_and_enrich_records(path, config.get("api"))

    if limit is not None:
        records = records[:limit]
        print(f"Лимит        : {limit} записей")
    if not records:
        print("[!] Ни одной записи не обогащено — прекращаем.")
        sys.exit(1)

    # 2. Конвертация в RAGAS dataset (с тем же предикатом что и filtered_records ниже)
    dataset = build_dataset(records)
    if len(dataset.samples) == 0:
        print("[!] После фильтрации невалидных записей датасет пуст.")
        sys.exit(1)

    # 3. LLM + embeddings
    llm = build_judge()
    embeddings = build_embeddings()

    # 4. Выбор метрик + автодискавери кастомных
    metrics = select_metrics(dataset, config.get("metrics"))
    print(f"Метрики      : {[m.name for m in metrics]}")

    # 5. evaluate — raise_exceptions=False (D-09, PITFALLS.md #6)
    run_config = RunConfig(max_workers=MAX_WORKERS, max_wait=MAX_WAIT)
    result = evaluate(
        dataset=dataset,
        metrics=metrics,
        llm=llm,
        embeddings=embeddings,
        run_config=run_config,
        raise_exceptions=False,
    )

    # 6. Сохранение — суффикс _ragas per D-06
    stem = path.stem
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = OUTPUT_DIR / f"{ts}_{stem}_ragas"
    run_dir.mkdir(parents=True, exist_ok=True)

    # Фильтруем records тем же предикатом что build_dataset,
    # чтобы zip(filtered_records, scores) не разъехался
    filtered_records = [
        r for r in records
        if (r.get("user_query") or "").strip() and (r.get("actual_answer") or "").strip()
    ]
    out_path = save_results(filtered_records, result, run_dir)
    print(f"\nПапка прогона → {run_dir}")
    print(f"metrics.json  → {out_path}")


def main(input_path: str, limit: Optional[int] = None) -> None:
    """Точка входа: валидирует путь, настраивает asyncio, запускает пайплайн."""
    path = Path(input_path)
    if not path.exists():
        print(f"Путь не найден: {path}")
        sys.exit(1)
    project_root = Path(__file__).parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    _apply_asyncio_policy()
    asyncio.run(run_pipeline(path, limit=limit))


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="RAGAS evaluation pipeline")
    parser.add_argument("input", help="Папка прогона DeepEval или путь к датасету JSON")
    parser.add_argument("--limit", type=int, default=None, help="Ограничить число записей (для тестирования)")
    args = parser.parse_args()
    main(args.input, limit=args.limit)
