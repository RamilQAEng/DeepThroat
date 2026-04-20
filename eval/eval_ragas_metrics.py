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

from openai import OpenAI as OpenAIClient, AsyncOpenAI as AsyncOpenAIClient
from ragas.dataset_schema import SingleTurnSample
from ragas.metrics.collections import (
    Faithfulness, AnswerRelevancy, ContextPrecision,
    ContextRecall, AnswerCorrectness,
)
from ragas.metrics.base import MetricWithLLM, SingleTurnMetric
from ragas.llms import llm_factory
from ragas.embeddings import OpenAIEmbeddings as RagasOpenAIEmbeddings

# ── Конфигурация верхнего уровня ──────────────────────────────────────────────

JUDGE_PROVIDER   = os.getenv("JUDGE_PROVIDER", "openai").lower()
JUDGE_MODEL_NAME = os.getenv("JUDGE_MODEL", "gpt-4o-mini")
EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "text-embedding-3-small")
MAX_WORKERS      = 3
MAX_WAIT         = 120
OUTPUT_DIR       = Path(__file__).parent / "results"
CONFIG_PATH      = Path(__file__).parent / "config" / "eval_config.yaml"
TARGETS_PATH     = Path(__file__).parent / "config" / "targets.yaml"
CUSTOM_METRICS_DIR = Path(__file__).parent / "custom_metrics"
OUTPUT_DIR.mkdir(exist_ok=True)


def load_eval_config() -> dict:
    """Читает eval/config/eval_config.yaml и возвращает dict конфигурации."""
    if not CONFIG_PATH.exists():
        warnings.warn(f"eval_config.yaml не найден: {CONFIG_PATH} — используются дефолты", UserWarning)
        return {}
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except yaml.YAMLError as e:
        print(f"[ERROR] Ошибка парсинга {CONFIG_PATH}: {e}")
        sys.exit(1)


def resolve_judge_config(cfg: dict) -> dict:
    """Резолвит настройки судьи из eval_config.yaml + targets.yaml.

    Приоритет:
      1. default_judge из eval_config.yaml → поиск в targets.yaml
      2. JUDGE_PROVIDER / JUDGE_MODEL из .env (фолбэк)
    Возвращает dict: {provider, model, name}.
    """
    judge_name = cfg.get("default_judge")
    if judge_name and TARGETS_PATH.exists():
        try:
            with open(TARGETS_PATH, encoding="utf-8") as f:
                targets_cfg = yaml.safe_load(f) or {}
            targets = {t["name"]: t for t in targets_cfg.get("targets", [])}
            if judge_name in targets:
                t = targets[judge_name]
                return {"provider": t["provider"], "model": t["model"], "name": judge_name}
            else:
                print(f"[WARN] Судья '{judge_name}' не найден в targets.yaml — используется .env")
        except yaml.YAMLError as e:
            print(f"[WARN] Ошибка парсинга targets.yaml: {e} — используется .env")

    # Фолбэк на .env
    return {
        "provider": os.getenv("JUDGE_PROVIDER", "openai").lower(),
        "model": os.getenv("JUDGE_MODEL", "gpt-4o-mini"),
        "name": os.getenv("JUDGE_MODEL", "gpt-4o-mini"),
    }


# Reasoning-модели на OpenRouter: thinking ломает PydanticPrompt JSON-вывод.
# Список определяется по имени модели — добавь сюда новые reasoning-модели по мере появления.
_OPENROUTER_REASONING_PREFIXES = (
    "qwen/qwen3",
    "qwen/qwq",
    "deepseek/deepseek-r",
    "deepseek/deepseek-reasoner",
    "openai/o1",
    "openai/o3",
    "openai/o4",
    "anthropic/claude",  # claude моделей thinking режим опциональный, не мешает
)

# Минимальный max_tokens для RAGAS: faithfulness генерирует длинные списки утверждений.
# 1024 (дефолт InstructorLLM) недостаточно — truncation → null scores.
_RAGAS_MAX_TOKENS = 4096


def _is_reasoning_model(model: str) -> bool:
    """Возвращает True если модель на OpenRouter использует thinking-режим по умолчанию."""
    m = model.lower()
    return any(m.startswith(p) for p in _OPENROUTER_REASONING_PREFIXES)


def build_judge(provider: str, model: str):
    """Создаёт LLM-судью через ragas.llms.llm_factory. Провайдеры: openai, openrouter.

    Использует AsyncOpenAI — llm_factory требует async-клиент для abatch_score/agenerate.

    max_tokens=4096 обязателен: RAGAS Faithfulness генерирует длинные списки утверждений,
    дефолтный лимит (1024) вызывает truncation → null scores.

    extra_body={"reasoning": {"effort": "none"}} — только для reasoning-моделей
    (Qwen3, QwQ, DeepSeek-R1): thinking-режим ломает PydanticPrompt JSON-парсинг.
    """
    if provider == "openrouter":
        client = AsyncOpenAIClient(
            api_key=os.environ["OPENROUTER_API_KEY"],
            base_url="https://openrouter.ai/api/v1",
        )
        factory_kwargs: dict = {"max_tokens": _RAGAS_MAX_TOKENS}
        if _is_reasoning_model(model):
            factory_kwargs["extra_body"] = {"reasoning": {"effort": "none"}}
        return llm_factory(model, client=client, **factory_kwargs)

    elif provider == "openai":
        kwargs: dict = {"api_key": os.environ["OPENAI_API_KEY"]}
        base_url = os.getenv("OPENAI_BASE_URL")
        if base_url:
            kwargs["base_url"] = base_url
        client = AsyncOpenAIClient(**kwargs)
    else:
        raise ValueError(
            f"Неизвестный провайдер судьи: '{provider}'. Поддерживаются: openai, openrouter"
        )
    return llm_factory(model, client=client, max_tokens=_RAGAS_MAX_TOKENS)


def build_embeddings() -> Optional[RagasOpenAIEmbeddings]:
    """RagasOpenAIEmbeddings нужны для AnswerRelevancy и AnswerCorrectness.

    Возвращает None если OPENAI_API_KEY не задан — тогда обе метрики пропускаются.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        warnings.warn(
            "OPENAI_API_KEY не задан — AnswerRelevancy и AnswerCorrectness будут пропущены (требуют embeddings)",
            UserWarning,
        )
        return None
    kwargs: dict = {"api_key": api_key}
    base_url = os.getenv("OPENAI_BASE_URL")
    if base_url:
        kwargs["base_url"] = base_url
    return RagasOpenAIEmbeddings(
        client=OpenAIClient(**kwargs),
        model=EMBEDDINGS_MODEL,
    )


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


def _filter_records(records: list[dict]) -> list[dict]:
    """Оставляет только записи с непустыми user_query и actual_answer."""
    return [
        r for r in records
        if (r.get("user_query") or "").strip() and (r.get("actual_answer") or "").strip()
    ]


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


def build_builtin_metrics(
    llm,
    has_context: bool,
    has_reference: bool,
    embeddings: Optional[RagasOpenAIEmbeddings] = None,
) -> list:
    """Создаёт список встроенных RAGAS-метрик (BaseMetric) с учётом graceful-skip.

    Логика:
    - AnswerRelevancy: только если embeddings доступны (требуют OpenAI embeddings API)
    - Faithfulness: только если есть retrieved_contexts
    - ContextPrecision, ContextRecall: только если есть contexts И reference
    - AnswerCorrectness: если есть reference; без embeddings — weights=[1.0, 0.0]
    """
    has_embeddings = embeddings is not None
    metrics: list = []

    if has_embeddings:
        metrics.append(AnswerRelevancy(llm=llm, embeddings=embeddings))
    else:
        warnings.warn("Embeddings недоступны — пропускаем AnswerRelevancy", UserWarning)

    if has_context:
        metrics.append(Faithfulness(llm=llm))
    else:
        warnings.warn(
            "retrieved_contexts пуст у всех записей — "
            "пропускаем Faithfulness, ContextPrecision, ContextRecall",
            UserWarning,
        )

    if has_context and has_reference:
        metrics.extend([ContextPrecision(llm=llm), ContextRecall(llm=llm)])

    if has_reference:
        if has_embeddings:
            metrics.append(AnswerCorrectness(llm=llm, embeddings=embeddings))
        else:
            # weights=[1.0, 0.0] — только factual component, semantic (embeddings) отключён
            metrics.append(AnswerCorrectness(llm=llm, weights=[1.0, 0.0]))

    return metrics


async def _score_builtin_metric(
    metric,
    records: list[dict],
) -> list[Optional[float]]:
    """Оценивает одну встроенную RAGAS-метрику через abatch_score().

    RAGAS 0.4.3: built-in метрики (Faithfulness, etc.) наследуют BaseMetric,
    НЕ совместимы с ragas.evaluation.evaluate() — используем abatch_score напрямую.

    Каждая метрика принимает ровно те поля, что объявлены в её ascore() сигнатуре.
    Мы инспектируем сигнатуру и фильтруем входной dict, чтобы не передавать лишних
    kwargs (иначе ascore поднимает TypeError на 'unexpected keyword argument').
    """
    import inspect

    # Определяем допустимые поля из сигнатуры ascore (кроме 'self')
    allowed_params: set[str] = set(inspect.signature(metric.ascore).parameters) - {"self"}

    # Полный пул полей для записи
    FIELD_MAP = {
        "user_input":        lambda r: r.get("user_query") or "",
        "response":          lambda r: r.get("actual_answer") or "",
        "retrieved_contexts": lambda r: [c for c in (r.get("retrieval_context") or []) if isinstance(c, str)],
        "reference":         lambda r: r.get("expected_answer"),
    }

    inputs = []
    for r in records:
        inp: dict = {}
        for field, extractor in FIELD_MAP.items():
            if field not in allowed_params:
                continue
            val = extractor(r)
            # Пропускаем None-значения для опциональных полей
            if val is None:
                continue
            # Пропускаем пустой список retrieved_contexts
            if field == "retrieved_contexts" and not val:
                continue
            inp[field] = val
        inputs.append(inp)

    try:
        results = await metric.abatch_score(inputs)
    except Exception as e:
        print(f"[WARN] {metric.name}: abatch_score упал — {e}")
        return [None] * len(records)

    scores: list[Optional[float]] = []
    for res in results:
        try:
            val = float(res.value) if res.value is not None else None
        except (TypeError, ValueError):
            val = None
        scores.append(val)
    return scores


async def _score_custom_metrics(
    custom_metrics: list,
    records: list[dict],
) -> dict[str, list[Optional[float]]]:
    """Оценивает все кастомные метрики через _single_turn_ascore(SingleTurnSample).

    Кастомные метрики (MetricWithLLM + SingleTurnMetric) используют старый API RAGAS.
    Каждая запись оценивается последовательно внутри метрики; метрики — параллельно.
    Возвращает {metric_name: [score_or_None, ...]}.
    """
    if not custom_metrics:
        return {}

    async def _score_one_metric(metric) -> tuple[str, list[Optional[float]]]:
        scores: list[Optional[float]] = []
        for r in records:
            sample = SingleTurnSample(
                user_input=r.get("user_query") or "",
                response=r.get("actual_answer") or "",
                retrieved_contexts=r.get("retrieval_context") or [],
                reference=r.get("expected_answer"),
            )
            try:
                val = await metric._single_turn_ascore(sample)
                scores.append(float(val) if val is not None else None)
            except Exception as e:
                print(f"[WARN] {metric.name}: _single_turn_ascore упал — {e}")
                scores.append(None)
        return metric.name, scores

    tasks = [_score_one_metric(m) for m in custom_metrics]
    pairs = await asyncio.gather(*tasks)
    return dict(pairs)


def save_results(
    records: list[dict],
    all_scores: dict[str, list[Optional[float]]],
    run_dir: Path,
) -> Path:
    """Сохраняет metrics.json в формате, совместимом с DeepEval UI (API route Phase 2).

    all_scores: {metric_name: [score_or_None per record]}
    Имена метрик маппируются в *_score поля:
      faithfulness         → faithfulness_score
      answer_relevancy     → answer_relevancy_score
      context_precision    → context_precision_score
      context_recall       → context_recall_score
      answer_correctness   → answer_correctness_score
      <custom>             → <custom>_score
    """
    BUILTIN_MAP = {
        "faithfulness":       "faithfulness_score",
        "answer_relevancy":   "answer_relevancy_score",
        "context_precision":  "context_precision_score",
        "context_recall":     "context_recall_score",
        "answer_correctness": "answer_correctness_score",
    }

    rows = []
    for i, rec in enumerate(records):
        row: dict = {
            "session_id":      rec.get("session_id") or rec.get("id"),
            "category":        rec.get("category"),
            "intent":          rec.get("intent"),
            "user_query":      rec.get("user_query"),
            "actual_answer":   rec.get("actual_answer"),
            "expected_answer": rec.get("expected_answer"),
            "retrieval_context": rec.get("retrieval_context") or [],
        }

        # Всегда пишем все стандартные ключи явным null — иначе на фронте
        # отсутствующий ключ даёт undefined, который проходит null-проверки
        # и приводит к NaN% в KPI-карточках.
        for out_key in BUILTIN_MAP.values():
            row[out_key] = None

        for metric_name, score_list in all_scores.items():
            val: Optional[float] = score_list[i] if i < len(score_list) else None
            # NaN → None: json.dump не поддерживает NaN
            if val is not None and val != val:
                val = None
            out_key = BUILTIN_MAP.get(metric_name, f"{metric_name}_score")
            row[out_key] = val

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


def resolve_judge_by_alias(alias: str) -> dict:
    """Ищет судью по имени в targets.yaml. Бросает ValueError если не найден."""
    if not TARGETS_PATH.exists():
        raise ValueError(f"targets.yaml не найден: {TARGETS_PATH}")
    with open(TARGETS_PATH, encoding="utf-8") as f:
        targets_cfg = yaml.safe_load(f) or {}
    targets = {t["name"]: t for t in targets_cfg.get("targets", [])}
    if alias not in targets:
        available = list(targets.keys())
        raise ValueError(f"Судья '{alias}' не найден в targets.yaml. Доступные: {available}")
    t = targets[alias]
    return {"provider": t["provider"], "model": t["model"], "name": alias}


async def run_pipeline(
    path: Path,
    limit: Optional[int] = None,
    fail_below: Optional[float] = None,
    judge_override: Optional[str] = None,
) -> None:
    """Основной async пайплайн RAGAS-оценки.

    RAGAS 0.4.3: evaluate() несовместима с метриками из ragas.metrics.collections
    (Faithfulness и др. наследуют BaseMetric, а не Metric → isinstance-проверка падает).
    Решение: вызываем abatch_score() на каждой метрике напрямую.
    """
    config = load_eval_config()
    judge_cfg = (
        resolve_judge_by_alias(judge_override)
        if judge_override
        else resolve_judge_config(config)
    )

    is_deepeval_run = path.is_dir()
    print(f"Режим        : {'DeepEval run (без API)' if is_deepeval_run else 'датасет JSON (с API)'}")
    print(f"Входной путь : {path}")
    print(f"Судья        : {judge_cfg['provider']} / {judge_cfg['model']} ({judge_cfg['name']})")
    print(f"Embeddings   : {EMBEDDINGS_MODEL}")

    # 1. Загрузка записей
    if is_deepeval_run:
        records = load_from_deepeval_run(path)
    else:
        records = load_and_enrich_records(path, config.get("api"))

    if limit is not None:
        records = records[:limit]
        print(f"Лимит        : {limit} записей")

    # 2. Фильтрация — убираем записи без обязательных полей
    records = _filter_records(records)
    if not records:
        print("[!] После фильтрации невалидных записей датасет пуст — прекращаем.")
        sys.exit(1)

    # 3. Определяем наличие данных для graceful-skip метрик
    has_context = any(r.get("retrieval_context") for r in records)
    has_reference = any(r.get("expected_answer") for r in records)

    # 4. LLM + embeddings
    llm = build_judge(provider=judge_cfg["provider"], model=judge_cfg["model"])
    embeddings = build_embeddings()

    # 5. Встроенные метрики (BaseMetric, abatch_score)
    builtin_metrics = build_builtin_metrics(llm, has_context, has_reference, embeddings)
    print(f"Встроенные   : {[m.name for m in builtin_metrics]}")

    # 6. Кастомные метрики (MetricWithLLM, _single_turn_ascore)
    custom_metrics = discover_custom_metrics()
    # Инжектируем llm в кастомные метрики
    for m in custom_metrics:
        if hasattr(m, "llm") and m.llm is None:
            m.llm = llm
    print(f"Кастомные    : {[m.name for m in custom_metrics]}")

    # 7. Скоринг — встроенные параллельно, затем кастомные
    all_scores: dict[str, list[Optional[float]]] = {}

    builtin_tasks = [_score_builtin_metric(m, records) for m in builtin_metrics]
    builtin_results = await asyncio.gather(*builtin_tasks)
    for metric, scores in zip(builtin_metrics, builtin_results):
        all_scores[metric.name] = scores
        passed = sum(1 for s in scores if s is not None and s >= 0.7)
        avg = sum(s for s in scores if s is not None) / max(1, sum(1 for s in scores if s is not None))
        print(f"  {metric.name}: avg={avg:.3f}, pass={passed}/{len(records)}")

    custom_scores = await _score_custom_metrics(custom_metrics, records)
    all_scores.update(custom_scores)

    # 8. Сохранение — суффикс _ragas per D-06
    stem = path.name if path.is_dir() else path.stem
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    judge_tag = f"_{judge_cfg['name']}" if judge_override else ""
    run_dir = OUTPUT_DIR / f"{ts}_{stem}{judge_tag}_ragas"
    run_dir.mkdir(parents=True, exist_ok=True)

    # meta.json — для provider comparison dashboard
    meta = {
        "judge_name": judge_cfg["name"],
        "judge_model": judge_cfg["model"],
        "provider": judge_cfg["provider"],
        "dataset": str(path),
        "timestamp": ts,
        "total_records": len(records),
    }
    (run_dir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    out_path = save_results(records, all_scores, run_dir)
    print(f"\nПапка прогона → {run_dir}")
    print(f"metrics.json  → {out_path}")

    # Quality gate: --fail-below
    if fail_below is not None:
        failed_metrics: list[str] = []
        for metric_name, scores in all_scores.items():
            valid = [s for s in scores if s is not None]
            if not valid:
                continue
            avg = sum(valid) / len(valid)
            status = "✓" if avg >= fail_below else "✗"
            print(f"  [{status}] {metric_name}: avg={avg:.3f} (порог={fail_below})")
            if avg < fail_below:
                failed_metrics.append(f"{metric_name}={avg:.3f}")
        if failed_metrics:
            print(f"\n[QUALITY GATE FAILED] Метрики ниже порога {fail_below}: {', '.join(failed_metrics)}")
            sys.exit(1)
        else:
            print(f"\n[QUALITY GATE PASSED] Все метрики ≥ {fail_below}")


def main(
    input_path: str,
    limit: Optional[int] = None,
    fail_below: Optional[float] = None,
    judge_override: Optional[str] = None,
) -> None:
    """Точка входа: валидирует путь, настраивает asyncio, запускает пайплайн."""
    path = Path(input_path)
    if not path.exists():
        print(f"Путь не найден: {path}")
        sys.exit(1)
    project_root = Path(__file__).parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    _apply_asyncio_policy()
    asyncio.run(run_pipeline(path, limit=limit, fail_below=fail_below, judge_override=judge_override))


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="RAGAS evaluation pipeline")
    parser.add_argument("input", help="Папка прогона DeepEval или путь к датасету JSON")
    parser.add_argument("--limit", type=int, default=None, help="Ограничить число записей (для тестирования)")
    parser.add_argument(
        "--fail-below", type=float, default=None, metavar="THRESHOLD",
        help="CI/CD quality gate: завершить с exit code 1 если avg любой метрики < THRESHOLD (например 0.75)"
    )
    parser.add_argument(
        "--judge", type=str, default=None, metavar="ALIAS",
        help="Переопределить судью по имени из targets.yaml (например gpt4o-mini-or, qwen-72b-or)"
    )
    args = parser.parse_args()
    main(args.input, limit=args.limit, fail_below=args.fail_below, judge_override=args.judge)
