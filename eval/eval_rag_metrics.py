"""
Pipeline: Answer Relevancy + Faithfulness (DeepEval) — параллельный прогон
==========================================================================
Запуск (из папки eval/):
  python eval_rag_metrics.py ../top_k/20260329_173829_exp_top_k_10.json

Настройка: скопируй .env.example → .env и заполни нужные поля.

Поля входного файла (с fallback для совместимости):
  user_query | question      → input (вопрос пользователя)
  actual_answer | actual_output → actual_output (ответ RAG)
  expected_output | expected_answer → expected_output (эталонный ответ)
  retrieval_context          → контекст для Faithfulness (список чанков)
                                Если поля нет — Faithfulness не считается.

Режимы работы:
  Офлайн: датасет содержит actual_output + question — оценка готовых ответов
  Онлайн: API запрашивается на лету, возвращает actual_answer + user_query + retrieval_context

Параллелизм:
  Каждая запись обрабатывается в отдельном потоке (ThreadPoolExecutor).
  MAX_WORKERS — максимум одновременных запросов к LLM-судье.
  Каждый поток создаёт свои экземпляры метрик (thread-safe).
"""

import os
import sys
import json
import csv
import asyncio
import threading
import yaml
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

from dotenv import load_dotenv
try:
    import httpx as _httpx
    _HAS_HTTPX = True
except ImportError:
    _HAS_HTTPX = False

# Загружаем .env из папки скрипта
load_dotenv(Path(__file__).parent / ".env")

from deepeval.test_case import LLMTestCase
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric, ContextualPrecisionMetric, ContextualRecallMetric
from deepeval.models.base_model import DeepEvalBaseLLM

# ── Конфигурация ──────────────────────────────────────────────────────────────

THRESHOLD        = 0.7   # дефолт (переопределяется из targets.yaml)
THRESHOLD_AR     = 0.7   # Answer Relevancy
THRESHOLD_FA     = 0.8   # Faithfulness
THRESHOLD_CP     = 0.7   # Contextual Precision
THRESHOLD_CR     = 0.6   # Contextual Recall
MAX_WORKERS      = 3
API_URL          = None  # устаревший хардкод
API_CONFIG: dict | None = None  # Новый динамический конфиг
LIMIT            = None  # если задан — обрабатывать только первые N записей
API_LOG: list    = []    # сырые ответы API (накапливается в потоках)
ERRORS_LOG: list = []    # ошибки прогона (накапливается в потоках)
API_LOG_LOCK     = threading.Lock()

# Результаты сохраняются в eval/results/
OUTPUT_DIR = Path(__file__).parent / "results"
OUTPUT_DIR.mkdir(exist_ok=True)

TARGETS_PATH_DE = Path(__file__).parent / "config" / "targets.yaml"


def _resolve_judge_by_alias_de(alias: str) -> dict:
    """Look up a judge alias in targets.yaml. Raises ValueError if not found."""
    if not TARGETS_PATH_DE.exists():
        raise ValueError(f"targets.yaml not found: {TARGETS_PATH_DE}")
    with open(TARGETS_PATH_DE, encoding="utf-8") as f:
        targets_cfg = yaml.safe_load(f) or {}
    targets = {t["name"]: t for t in targets_cfg.get("targets", [])}
    if alias not in targets:
        raise ValueError(f"Judge '{alias}' not in targets.yaml. Available: {list(targets.keys())}")
    t = targets[alias]
    return {
        "provider": t["provider"].lower(),
        "model": t["model"],
        "name": alias,
        "no_reasoning": t.get("no_reasoning", False),
    }


JUDGE_PROVIDER    = os.getenv("JUDGE_PROVIDER", "openai").lower()
JUDGE_MODEL_NAME  = os.getenv("JUDGE_MODEL", "gpt-4o-mini")
JUDGE_NO_REASONING = False

# ── Кастомные судьи ───────────────────────────────────────────────────────────

class OpenRouterJudge(DeepEvalBaseLLM):
    """Судья на базе OpenRouter (OpenAI-совместимый API)."""

    def __init__(self, model: str, no_reasoning: bool = False):
        self.model = model
        self.no_reasoning = no_reasoning
        from openai import OpenAI

        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is not set")

        print(f"[OpenRouterJudge] Initializing with model: {model}, API key: {api_key[:10]}...")

        self.client = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
        )

    def get_model_name(self) -> str:
        return self.model

    def load_model(self):
        return self.client

    def _clean_json(self, text: str) -> str:
        import re
        match = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
        if match:
            return match.group(0)
        return text.strip()

    def generate(self, prompt: str) -> str:
        extra = {"reasoning": {"exclude": True}} if self.no_reasoning else {}
        system_prompt = (
            "You are an evaluation assistant. "
            "CRITICAL: The 'reason' field in your JSON MUST be written strictly in Russian (НА РУССКОМ ЯЗЫКЕ). "
            "Keep all other JSON fields and structure exactly as required. "
            "IMPORTANT: You MUST return ONLY valid JSON. "
            "Do not include any intro text, markdown formatting (like ```json), or conversational fillers. "
            "Your response must start with { and end with }."
        )
        
        # Усиливаем user prompt в самом конце
        prompt_suffix = "\n\n[CRITICAL FINAL INSTRUCTION]\nThe value of the 'reason' field MUST be written in fluent Russian language (по-русски)."
        prompt += prompt_suffix
        
        response = self.client.chat.completions.create(
            model=self.model,
            extra_body=extra,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
        )
        return self._clean_json(response.choices[0].message.content)

    async def a_generate(self, prompt: str) -> str:
        return await asyncio.get_event_loop().run_in_executor(
            None, self.generate, prompt
        )


class GigaChatJudge(DeepEvalBaseLLM):
    """Судья на базе GigaChat (Sber)."""

    def __init__(self, model: str):
        self.model = model

    def get_model_name(self) -> str:
        return self.model

    def load_model(self):
        from gigachat import GigaChat
        return GigaChat

    def _clean_json(self, text: str) -> str:
        import re
        match = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
        if match:
            return match.group(0)
        return text.strip()

    def generate(self, prompt: str) -> str:
        from gigachat import GigaChat
        from gigachat.models import Chat, Messages, MessagesRole
        
        system_prompt = (
            "You are an evaluation assistant. "
            "CRITICAL: The 'reason' field in your JSON MUST be written strictly in Russian (НА РУССКОМ ЯЗЫКЕ). "
            "Keep all other JSON fields and structure exactly as required. "
            "IMPORTANT: You MUST return ONLY valid JSON. "
            "Do not include any intro text, markdown formatting (like ```json), or conversational fillers. "
            "Your response must start with { and end with }."
        )
        
        prompt_suffix = "\n\n[CRITICAL FINAL INSTRUCTION]\nThe value of the 'reason' field MUST be written in fluent Russian language (по-русски)."
        prompt += prompt_suffix
        
        with GigaChat(credentials=os.environ["GIGACHAT_CREDENTIALS"],
                      verify_ssl_certs=False) as client:
            response = client.chat(Chat(
                model=self.model,
                messages=[
                    Messages(role=MessagesRole.SYSTEM, content=system_prompt),
                    Messages(role=MessagesRole.USER, content=prompt),
                ],
            ))
        return self._clean_json(response.choices[0].message.content)

    async def a_generate(self, prompt: str) -> str:
        return await asyncio.get_event_loop().run_in_executor(
            None, self.generate, prompt
        )


def build_judge(verbose: bool = False):
    """Создаёт экземпляр судьи по JUDGE_PROVIDER из .env."""
    if JUDGE_PROVIDER == "openrouter":
        if verbose:
            print(f"Судья : OpenRouter / {JUDGE_MODEL_NAME}")
        return OpenRouterJudge(model=JUDGE_MODEL_NAME, no_reasoning=JUDGE_NO_REASONING)
    elif JUDGE_PROVIDER == "gigachat":
        if verbose:
            print(f"Судья : GigaChat / {JUDGE_MODEL_NAME}")
        return GigaChatJudge(model=JUDGE_MODEL_NAME)
    else:
        if verbose:
            print(f"Судья : OpenAI / {JUDGE_MODEL_NAME}")
        # OpenAI — передаём строку напрямую, DeepEval использует openai-клиент
        return JUDGE_MODEL_NAME


# ── Чекпоинт ─────────────────────────────────────────────────────────────────

def checkpoint_path(run_dir: Path) -> Path:
    return run_dir / "checkpoint.json"

def load_checkpoint(run_dir: Path) -> dict:
    """Возвращает уже обработанные записи {session_id: result}."""
    path = checkpoint_path(run_dir)
    if path.exists():
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        print(f"Найден чекпоинт: {len(data)} уже обработанных записей → пропускаем.")
        return data
    return {}

def save_checkpoint(run_dir: Path, done: dict, lock: threading.Lock):
    """Перезаписывает чекпоинт под локом (thread-safe)."""
    with lock:
        with open(checkpoint_path(run_dir), "w", encoding="utf-8") as f:
            json.dump(done, f, ensure_ascii=False, indent=2)

def clear_checkpoint(run_dir: Path):
    p = checkpoint_path(run_dir)
    if p.exists():
        p.unlink()


# ── Markdown-отчёт ────────────────────────────────────────────────────────────

def generate_report(results: list[dict], skipped: int, ts: str,
                    stem: str, detail_json: Path, detail_csv: Path,
                    run_dir: Path, input_path: Path | None = None) -> Path:
    from collections import defaultdict

    ar_scores = [r["answer_relevancy_score"]      for r in results if r["answer_relevancy_score"]      is not None]
    fa_scores = [r["faithfulness_score"]           for r in results if r["faithfulness_score"]           is not None]
    cp_scores = [r["contextual_precision_score"]   for r in results if r.get("contextual_precision_score") is not None]
    cr_scores = [r["contextual_recall_score"]      for r in results if r.get("contextual_recall_score")    is not None]

    def mean(vals): return sum(vals) / len(vals) if vals else None
    def passed(vals, threshold): return sum(1 for v in vals if v >= threshold)
    def score_bar(v): return "🟢" if v >= THRESHOLD_AR else ("🟡" if v >= 0.5 else "🔴")

    def format_reason(reason: str | None) -> str:
        """Заменяет английский префикс DeepEval 'The score is X because Y' на 'Оценка X: Y'."""
        if not reason:
            return "—"
        import re
        m = re.match(r"The score is ([\d.]+) because (.+)", reason, re.DOTALL)
        if m:
            return f"Оценка {m.group(1)}: {m.group(2).strip()}"
        return reason

    # Группировка по категории
    by_category: dict[str, list] = defaultdict(list)
    for r in results:
        by_category[r["category"]].append(r)

    lines = []

    # Заголовок
    api_log_path = run_dir / "api_responses.json"
    lines += [
        f"# Отчёт по качеству RAG — {ts[:8]}",
        "",
        f"**Дата прогона:** {ts[:4]}-{ts[4:6]}-{ts[6:8]} {ts[9:11]}:{ts[11:13]}:{ts[13:15]}",
        f"**Судья:** {JUDGE_PROVIDER} / {JUDGE_MODEL_NAME}",
        "",
        "## Файлы прогона",
        "",
        "| Файл | Описание |",
        "|---|---|",
        f"| [{stem}.json]({input_path}) | Датасет — вопросы, эталонные ответы, категории |" if input_path else f"| `{stem}` | Датасет |",
        f"| [api_responses.json](api_responses.json) | Сырые ответы RAG-системы: вопрос → ответ бота + чанки |" if api_log_path.exists() else "",
        f"| [metrics.json](metrics.json) | Детальные результаты по каждой записи (score, passed, reason) |",
        f"| [metrics.csv](metrics.csv) | То же в табличном формате для Excel/Pandas |",
        f"| [errors_log.json](errors_log.json) | Ошибки прогона: API-таймауты, невалидный JSON судьи |",
        "",
    ]
    # Убираем пустые строки из таблицы (если api_log не существует)
    lines = [l for l in lines if l != ""]
    lines.append("")

    # Общие метрики
    cp_scores = [r["contextual_precision_score"] for r in results if r.get("contextual_precision_score") is not None]
    cr_scores = [r["contextual_recall_score"]    for r in results if r.get("contextual_recall_score")    is not None]
    total = len(results)

    lines += ["## Общий результат", ""]
    lines += ["| Метрика | Вычислено | Среднее | Pass | Pass% | Порог |",
              "|---|---|---|---|---|---|"]
    if ar_scores:
        p = passed(ar_scores, THRESHOLD_AR)
        lines.append(f"| Answer Relevancy (AR) | {len(ar_scores)}/{total} | **{mean(ar_scores):.3f}** | {p}/{len(ar_scores)} | **{p/len(ar_scores)*100:.0f}%** | {THRESHOLD_AR} |")
    if fa_scores:
        p = passed(fa_scores, THRESHOLD_FA)
        lines.append(f"| Faithfulness (FA) | {len(fa_scores)}/{total} | **{mean(fa_scores):.3f}** | {p}/{len(fa_scores)} | **{p/len(fa_scores)*100:.0f}%** | {THRESHOLD_FA} |")
    if cp_scores:
        p = passed(cp_scores, THRESHOLD_CP)
        lines.append(f"| Contextual Precision (CP) | {len(cp_scores)}/{total} | **{mean(cp_scores):.3f}** | {p}/{len(cp_scores)} | **{p/len(cp_scores)*100:.0f}%** | {THRESHOLD_CP} |")
    if cr_scores:
        p = passed(cr_scores, THRESHOLD_CR)
        lines.append(f"| Contextual Recall (CR) | {len(cr_scores)}/{total} | **{mean(cr_scores):.3f}** | {p}/{len(cr_scores)} | **{p/len(cr_scores)*100:.0f}%** | {THRESHOLD_CR} |")

    lines += ["", f"> Обработано: **{len(results)}** записей, пропущено (ошибки): **{skipped}**", ""]

    # По категориям
    lines += ["## Результаты по категориям", ""]
    lines += ["| Категория | Записей | AR среднее | AR pass% |",
              "|---|---|---|---|"]
    for cat, recs in sorted(by_category.items()):
        ar = [r["answer_relevancy_score"] for r in recs if r["answer_relevancy_score"] is not None]
        if ar:
            p_pct = passed(ar, THRESHOLD_AR) / len(ar) * 100
            lines.append(f"| {cat} | {len(recs)} | {mean(ar):.3f} | {p_pct:.0f}% |")
    lines.append("")

    # Детальные результаты
    lines += ["## Детальные результаты", ""]
    for r in results:
        ar = r["answer_relevancy_score"]
        ar_str = f"{ar:.3f}" if ar is not None else "—"
        icon = score_bar(ar) if ar is not None else "⚪"
        fa = r["faithfulness_score"]
        fa_str = f"{fa:.3f}" if fa is not None else "—"

        lines += [
            f"### {icon} {r.get('id') or r.get('session_id') or '—'} — {r['category']}",
            "",
            f"**Вопрос:** {r['user_query']}",
            "",
            "**Ожидаемый ответ:**",
            "",
            "\n".join("> " + line for line in (r.get('expected_answer') or '—').strip().splitlines()) or "> —",
            "",
            "**Ответ бота:**",
            "",
            "\n".join("> " + line for line in r['actual_answer'].strip().splitlines()),
            "",
            f"| Метрика | Score | Pass |",
            f"|---|---|---|",
            f"| Answer Relevancy     | {ar_str} | {chr(0x2705) if r['answer_relevancy_passed'] else chr(0x274C)} |",
        ]
        if fa is not None:
            lines.append(f"| Faithfulness         | {fa_str} | {chr(0x2705) if r['faithfulness_passed'] else chr(0x274C)} |")
        _cp = r.get("contextual_precision_score")
        _cr = r.get("contextual_recall_score")
        if _cp is not None:
            lines.append(f"| Contextual Precision | {_cp:.3f} | {chr(0x2705) if r.get('contextual_precision_passed') else chr(0x274C)} |")
        if _cr is not None:
            lines.append(f"| Contextual Recall    | {_cr:.3f} | {chr(0x2705) if r.get('contextual_recall_passed') else chr(0x274C)} |")
        lines += ["", "**Комментарии судьи:**", ""]
        lines.append(f"> **AR:** {format_reason(r['answer_relevancy_reason'])}")
        lines.append("")
        if r.get('faithfulness_reason'):
            lines.append(f"> **FA:** {format_reason(r['faithfulness_reason'])}")
            lines.append("")
        if r.get('contextual_precision_reason'):
            lines.append(f"> **CP:** {format_reason(r['contextual_precision_reason'])}")
            lines.append("")
        if r.get('contextual_recall_reason'):
            lines.append(f"> **CR:** {format_reason(r['contextual_recall_reason'])}")
            lines.append("")
        lines += [
            "",
            "---",
            "",
        ]

    # Ссылки на файлы
    lines += [
        "## Файлы",
        "",
        f"- JSON: `{detail_json.name}`",
        f"- CSV: `{detail_csv.name}`",
    ]

    report_path = run_dir / "report.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


def get_value_by_path(data: dict, path: str, default=None):
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
    if isinstance(template, str):
        res = template
        for k, v in rec.items():
            if isinstance(v, str):
                res = res.replace(f"{{{{{k}}}}}", v)
        return res
    elif isinstance(template, dict):
        res = {}
        for k, v in template.items():
            res[k] = resolve_template(v, rec)
        return res
    elif isinstance(template, list):
        return [resolve_template(v, rec) for v in template]
    return template

def fetch_from_api(rec: dict) -> dict:
    """Вызывает динамический RAG API согласно API_CONFIG."""
    if not _HAS_HTTPX:
        raise RuntimeError("httpx не установлен: pip install httpx")
    
    if API_CONFIG:
        config = API_CONFIG
    elif API_URL:
        # Fallback на старый хардкод
        config = {
            "url": API_URL.rstrip("/") + "/api/v1/eval/rag",
            "method": "POST",
            "headers": {},
            "body": {"question": "{{user_query}}", "category": "{{category}}"},
            "extractors": {
                "answer": "answer",
                "chunks": "retrieved_chunks"
            }
        }
    else:
        raise RuntimeError("API_URL или API_CONFIG не задан")

    question = rec.get("question") or rec.get("user_query", "")
    category = rec.get("category") or rec.get("intent", "")

    # Обогащаем rec для теплейтов
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
            raise ValueError(f"Unsupported method: {method}")

    if resp.status_code != 200:
        raise RuntimeError(f"API {resp.status_code} at {url}: {resp.text[:200]}")

    try:
        data = resp.json()
    except Exception as e:
        raise RuntimeError(f"API returned invalid JSON: {resp.text[:200]}")

    ex_answer = config.get("extractors", {}).get("answer", "answer")
    ex_chunks = config.get("extractors", {}).get("chunks", "retrieved_chunks")
    
    answer = get_value_by_path(data, ex_answer, "")
    chunks_raw = get_value_by_path(data, ex_chunks, [])
    
    # Пытаемся извлечь текст из чанков
    chunks_text = []
    if isinstance(chunks_raw, list):
        for c in chunks_raw:
            if isinstance(c, str):
                chunks_text.append(c)
            elif isinstance(c, dict):
                # Ищем стандартные ключи
                if "content" in c:
                    chunks_text.append(c["content"])
                elif "text" in c:
                    chunks_text.append(c["text"])
                else:
                    chunks_text.append(str(c))
    else:
        chunks_text = [str(chunks_raw)]

    enriched = dict(rec)
    enriched["user_query"]        = question
    enriched["actual_answer"]     = answer
    enriched["retrieval_context"] = chunks_text

    log_entry = {
        "id":              rec.get("id") or rec.get("session_id"),
        "question":        question,
        "category":        category,
        "answer":          answer,
        "chunks_count":    len(chunks_text),
        "retrieved_chunks": [{"content": c} for c in chunks_text],
        "api_url":         url
    }
    with API_LOG_LOCK:
        API_LOG.append(log_entry)

    return enriched


# ── Обработка одной записи (выполняется в отдельном потоке) ───────────────────

def evaluate_record(rec: dict, index: int, total: int,
                    done: dict, lock: threading.Lock, run_dir: Path) -> dict | None:
    """Создаёт свои экземпляры метрик и вычисляет score + reason для записи."""

    try:
        return _evaluate_record_inner(rec, index, total, done, lock, run_dir)
    except Exception as e:
        import traceback
        rec_id = rec.get("id") or rec.get("session_id") or f"index-{index}"
        error_details = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"

        # КРИТИЧНО: Логируем В КОНСОЛЬ немедленно
        print(f"\n{'='*80}")
        print(f"[CRITICAL ERROR] Record {rec_id} failed!")
        print(f"{'='*80}")
        print(error_details)
        print(f"{'='*80}\n")

        # Сохраняем в файл НЕМЕДЛЕННО
        try:
            error_file = run_dir / f"error_{rec_id}.txt"
            with open(error_file, "w", encoding="utf-8") as f:
                f.write(f"Record ID: {rec_id}\n")
                f.write(f"Question: {rec.get('question') or rec.get('user_query', '')}\n\n")
                f.write(error_details)
            print(f"[ERROR] Saved to {error_file}")
        except Exception as save_err:
            print(f"[ERROR] Failed to save error file: {save_err}")

        with API_LOG_LOCK:
            ERRORS_LOG.append({
                "id": rec_id,
                "question": rec.get("question") or rec.get("user_query", ""),
                "error": error_details,
                "stage": "evaluate_record"
            })
        return None


def _evaluate_record_inner(rec: dict, index: int, total: int,
                           done: dict, lock: threading.Lock, run_dir: Path) -> dict | None:
    """Внутренняя функция обработки записи."""

    # Онлайн-режим: получаем свежий ответ + чанки из живого API
    if API_URL or API_CONFIG:
        try:
            rec = fetch_from_api(rec)
        except Exception as e:
            question = rec.get("question") or rec.get("user_query", "")
            rec_id = rec.get("id") or rec.get("session_id") or f"index-{index}"
            msg = str(e)
            print(f"[{index}/{total}] API error [{rec_id}]: {msg}")
            with API_LOG_LOCK:
                ERRORS_LOG.append({"id": rec_id, "question": question, "error": msg, "stage": "api"})
            return None

    rec_id = rec.get("id") or rec.get("session_id") or f"index-{index}"

    # Offline mode: dataset has 'actual_output' (answer from previous run)
    # Online mode: API populates 'actual_answer' (fresh answer from API)
    actual_answer = rec.get("actual_answer") or rec.get("actual_output")
    if not actual_answer:
        print(f"[SKIP] {rec_id}: Missing answer field (neither 'actual_answer' nor 'actual_output')")
        return None

    # Normalize field name for downstream processing
    if not rec.get("actual_answer"):
        rec["actual_answer"] = actual_answer

    # Normalize user_query field (support both 'user_query' and 'question')
    user_query = rec.get("user_query") or rec.get("question")
    if not user_query:
        print(f"[SKIP] {rec_id}: Missing query field (neither 'user_query' nor 'question')")
        return None
    if not rec.get("user_query"):
        rec["user_query"] = user_query

    if rec.get("error"):
        print(f"[SKIP] {rec_id}: Record has 'error' field: {rec.get('error')}")
        return None

    # Пропускаем уже обработанные (восстановление после падения)
    session_key = rec.get("id") or rec.get("session_id") or f"idx-{index}"
    session_key = str(session_key)
    if session_key in done:
        print(f"[{index}/{total}] {session_key} — чекпоинт, пропускаем")
        return done[session_key]

    context = rec.get("retrieval_context")
    has_context = isinstance(context, list) and len(context) > 0

    # Поддерживаем оба имени поля: expected_output (спек) и expected_answer (legacy)
    expected = rec.get("expected_output") or rec.get("expected_answer") or ""
    has_expected = bool(expected)

    tc = LLMTestCase(
        input=rec["user_query"],
        actual_output=rec["actual_answer"],
        expected_output=expected if has_expected else None,
        retrieval_context=context if has_context else None,
    )

    # Каждый поток создаёт своего судью и метрики (thread-safe)
    judge = build_judge(verbose=False)
    ar_metric = AnswerRelevancyMetric(
        threshold=THRESHOLD_AR, model=judge, include_reason=True
    )
    fa_metric = FaithfulnessMetric(
        threshold=THRESHOLD_FA, model=judge, include_reason=True
    )
    cp_metric = ContextualPrecisionMetric(
        threshold=THRESHOLD_CP, model=judge, include_reason=True
    )
    cr_metric = ContextualRecallMetric(
        threshold=THRESHOLD_CR,
        model=judge, include_reason=True
    )

    rec_id = rec.get("id") or rec.get("session_id") or f"index-{index}"

    enabled_metrics = API_CONFIG.get("metrics", ["AR", "FA", "CP", "CR"]) if API_CONFIG else ["AR", "FA", "CP", "CR"]

    # Answer Relevancy
    if "AR" in enabled_metrics:
        try:
            ar_metric.measure(tc)
            ar_score  = ar_metric.score
            ar_passed = ar_metric.is_successful()
            ar_reason = ar_metric.reason
        except Exception as e:
            import traceback
            error_details = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
            ar_score, ar_passed, ar_reason = None, False, f"ERROR: {e}"
            print(f"[ERROR] AR metric failed for {rec_id}: {error_details}")
            with API_LOG_LOCK:
                ERRORS_LOG.append({"id": rec_id, "question": rec.get("user_query", ""), "error": error_details, "stage": "metric_ar"})
    else:
        ar_score, ar_passed, ar_reason = None, None, "skipped"

    # Faithfulness — только если есть чанки
    if has_context and "FA" in enabled_metrics:
        try:
            fa_metric.measure(tc)
            fa_score  = fa_metric.score
            fa_passed = fa_metric.is_successful()
            fa_reason = fa_metric.reason
        except Exception as e:
            import traceback
            error_details = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
            fa_score, fa_passed, fa_reason = None, False, f"ERROR: {e}"
            print(f"[ERROR] FA metric failed for {rec_id}: {error_details}")
            with API_LOG_LOCK:
                ERRORS_LOG.append({"id": rec_id, "question": rec.get("user_query", ""), "error": error_details, "stage": "metric_fa"})
    else:
        fa_score, fa_passed, fa_reason = None, None, "skipped or no retrieval_context"

    # Contextual Precision — если есть чанки и expected
    if has_context and has_expected and "CP" in enabled_metrics:
        try:
            cp_metric.measure(tc)
            cp_score  = cp_metric.score
            cp_passed = cp_metric.is_successful()
            cp_reason = cp_metric.reason
        except Exception as e:
            import traceback
            error_details = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
            cp_score, cp_passed, cp_reason = None, False, f"ERROR: {e}"
            print(f"[ERROR] CP metric failed for {rec_id}: {error_details}")
            with API_LOG_LOCK:
                ERRORS_LOG.append({"id": rec_id, "question": rec.get("user_query", ""), "error": error_details, "stage": "metric_cp"})
    else:
        cp_score, cp_passed, cp_reason = None, None, "skipped, no context, or no expected"

    # Contextual Recall — если есть чанки и expected
    if has_context and has_expected and "CR" in enabled_metrics:
        try:
            cr_metric.measure(tc)
            cr_score  = cr_metric.score
            cr_passed = cr_metric.is_successful()
            cr_reason = cr_metric.reason
        except Exception as e:
            import traceback
            error_details = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
            cr_score, cr_passed, cr_reason = None, False, f"ERROR: {e}"
            print(f"[ERROR] CR metric failed for {rec_id}: {error_details}")
            with API_LOG_LOCK:
                ERRORS_LOG.append({"id": rec_id, "question": rec.get("user_query", ""), "error": error_details, "stage": "metric_cr"})
    else:
        cr_score, cr_passed, cr_reason = None, None, "skipped, no context, or no expected"

    # Лог строки
    ar_lbl = f"{ar_score:.3f}" if ar_score is not None else "—"
    fa_lbl = f"{fa_score:.3f}" if fa_score is not None else "—"
    cp_lbl = f"{cp_score:.3f}" if cp_score is not None else "—"
    cr_lbl = f"{cr_score:.3f}" if cr_score is not None else "—"
    label  = f"AR={ar_lbl} FA={fa_lbl} CP={cp_lbl} CR={cr_lbl}"
    print(f"[{index}/{total}] {label}  {rec['user_query'][:40]}")

    result = {
        "id":                        rec.get("id"),          # TC-001, TC-002, ...
        "session_id":                rec.get("session_id"),
        "top_k":                     rec.get("top_k"),
        "category":                  rec.get("category"),
        "intent":                    rec.get("intent"),
        "user_query":                rec["user_query"],
        "expected_answer":           expected,
        "actual_answer":             rec["actual_answer"],
        "answer_relevancy_score":    ar_score,
        "answer_relevancy_passed":   ar_passed,
        "answer_relevancy_reason":   ar_reason,
        "faithfulness_score":        fa_score,
        "faithfulness_passed":       fa_passed,
        "faithfulness_reason":       fa_reason,
        "contextual_precision_score":  cp_score,
        "contextual_precision_passed": cp_passed,
        "contextual_precision_reason": cp_reason,
        "contextual_recall_score":     cr_score,
        "contextual_recall_passed":    cr_passed,
        "contextual_recall_reason":    cr_reason,
    }

    with lock:
        done[session_key] = result
    save_checkpoint(run_dir, done, lock)

    return result


# ── Main ──────────────────────────────────────────────────────────────────────

def main(input_path: str, fail_below: float | None = None, judge_override: str | None = None) -> Path:
    global JUDGE_PROVIDER, JUDGE_MODEL_NAME, JUDGE_NO_REASONING

    # Apply judge override from targets.yaml alias
    judge_cfg: dict | None = None
    if judge_override:
        try:
            judge_cfg = _resolve_judge_by_alias_de(judge_override)
            JUDGE_PROVIDER = judge_cfg["provider"]
            JUDGE_MODEL_NAME = judge_cfg["model"]
            JUDGE_NO_REASONING = judge_cfg.get("no_reasoning", False)
            print(f"[--judge] Overriding judge: {judge_override} → {JUDGE_PROVIDER}/{JUDGE_MODEL_NAME}")
        except ValueError as exc:
            print(f"[ERROR] {exc}", file=sys.stderr)
            sys.exit(1)

    path = Path(input_path)
    if not path.exists():
        print(f"Файл не найден: {path}")
        sys.exit(1)

    with open(path, encoding="utf-8") as f:
        records = json.load(f)
    if LIMIT:
        records = records[:LIMIT]

    stem = path.stem
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    judge_tag = f"_{judge_override}" if judge_override else ""
    run_dir = OUTPUT_DIR / f"{ts}_{stem}{judge_tag}"
    run_dir.mkdir(parents=True, exist_ok=True)

    # meta.json — for provider comparison dashboard
    meta = {
        "judge_name": judge_override or JUDGE_PROVIDER,
        "judge_model": JUDGE_MODEL_NAME,
        "provider": JUDGE_PROVIDER,
        "dataset": str(path),
        "timestamp": ts,
        "total_records": len(records),
        "framework": "deepeval",
    }
    (run_dir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    done = load_checkpoint(run_dir)
    lock = threading.Lock()

    build_judge(verbose=True)  # выводим информацию о судье один раз
    print(f"Загружено записей    : {len(records)}")
    print(f"Параллельных потоков : {MAX_WORKERS}")
    print(f"Папка прогона        : {run_dir}\n")

    results_by_index = {}
    skipped = 0
    errors: list[dict] = []

    print("[DEBUG] Starting ThreadPoolExecutor...")
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        print("[DEBUG] Submitting tasks...")
        futures = {}
        for i, rec in enumerate(records):
            try:
                future = executor.submit(evaluate_record, rec, i + 1, len(records), done, lock, run_dir)
                futures[future] = i
                print(f"[DEBUG] Submitted task {i+1}/{len(records)}")
            except Exception as submit_err:
                print(f"[ERROR] Failed to submit task {i}: {submit_err}")
                import traceback
                traceback.print_exc()

        print(f"[DEBUG] Waiting for {len(futures)} futures to complete...")
        for future in as_completed(futures):
            original_index = futures[future]
            rec = records[original_index]
            rec_id = rec.get("id") or rec.get("session_id") or f"index-{original_index}"
            print(f"[DEBUG] Processing result for {rec_id}...")
            try:
                result = future.result()
                print(f"[DEBUG] Got result for {rec_id}: {type(result)}")
            except Exception as exc:
                print(f"\n[ERROR] Future failed for {rec_id}:")
                import traceback
                traceback.print_exc()
                errors.append({"id": rec_id, "question": rec.get("question") or rec.get("user_query", ""), "error": str(exc)})
                skipped += 1
                continue
            if result is None:
                print(f"[DEBUG] Result is None for {rec_id}, skipping")
                skipped += 1
            else:
                print(f"[DEBUG] Storing result for {rec_id}")
                results_by_index[original_index] = result

    # Восстанавливаем исходный порядок (as_completed не гарантирует порядок)
    results = [results_by_index[i] for i in sorted(results_by_index)]

    # Сохраняем ошибки СРАЗУ после завершения потоков
    if ERRORS_LOG:
        err_path = run_dir / "errors_log.json"
        with open(err_path, "w", encoding="utf-8") as f:
            json.dump(ERRORS_LOG, f, ensure_ascii=False, indent=2)
        print(f"\nОшибки [{len(ERRORS_LOG)}] сохранены → {err_path}")

    if not results:
        print(f"\n[!] Нет успешных результатов — все записи завершились с ошибкой.")
        if ERRORS_LOG:
            print("\n[!] Детали ошибок:")
            for err in ERRORS_LOG[:10]:  # Показываем первые 10 ошибок
                print(f"  - {err.get('stage', 'unknown')}: {err.get('error', 'no details')[:200]}")
        return

    detail_json = run_dir / "metrics.json"
    with open(detail_json, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    if API_LOG:
        api_log_path = run_dir / "api_responses.json"
        with open(api_log_path, "w", encoding="utf-8") as f:
            json.dump(API_LOG, f, ensure_ascii=False, indent=2)
        print(f"API-лог      → {api_log_path}")

    detail_csv = run_dir / "metrics.csv"
    with open(detail_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    # Сводка
    ar_scores = [r["answer_relevancy_score"]      for r in results if r["answer_relevancy_score"]      is not None]
    fa_scores = [r["faithfulness_score"]           for r in results if r["faithfulness_score"]           is not None]
    cp_scores = [r["contextual_precision_score"]   for r in results if r.get("contextual_precision_score") is not None]
    cr_scores = [r["contextual_recall_score"]      for r in results if r.get("contextual_recall_score")    is not None]

    print(f"\n{'='*55}")
    print(f"Обработано : {len(results)}  |  пропущено: {skipped}")
    if ar_scores:
        mean_ar = sum(ar_scores) / len(ar_scores)
        pass_ar = sum(1 for s in ar_scores if s >= THRESHOLD_AR)
        print(f"Answer Relevancy : {mean_ar:.4f}  |  pass {pass_ar}/{len(ar_scores)}  (порог {THRESHOLD_AR})")
    if fa_scores:
        mean_fa = sum(fa_scores) / len(fa_scores)
        pass_fa = sum(1 for s in fa_scores if s >= THRESHOLD_FA)
        print(f"Faithfulness     : {mean_fa:.4f}  |  pass {pass_fa}/{len(fa_scores)}  (порог {THRESHOLD_FA})")
    else:
        print(f"Faithfulness     : — (нет поля retrieval_context в данных)")
    if cp_scores:
        mean_cp = sum(cp_scores) / len(cp_scores)
        pass_cp = sum(1 for s in cp_scores if s >= THRESHOLD_CP)
        print(f"Contextual Prec  : {mean_cp:.4f}  |  pass {pass_cp}/{len(cp_scores)}  (порог {THRESHOLD_CP})")
    if cr_scores:
        mean_cr = sum(cr_scores) / len(cr_scores)
        pass_cr = sum(1 for s in cr_scores if s >= THRESHOLD_CR)
        print(f"Contextual Recall: {mean_cr:.4f}  |  pass {pass_cr}/{len(cr_scores)}  (порог {THRESHOLD_CR})")
    print(f"\nПапка прогона → {run_dir}")

    report_path = generate_report(results, skipped, ts, stem, detail_json, detail_csv, run_dir, input_path=path)
    print(f"Отчёт MD   → {report_path}")

    clear_checkpoint(run_dir)
    print("Чекпоинт удалён.")

    # Quality gate: --fail-below
    if fail_below is not None:
        score_map = {
            "answer_relevancy": ar_scores,
            "faithfulness": fa_scores,
            "contextual_precision": cp_scores,
            "contextual_recall": cr_scores,
        }
        failed_metrics: list[str] = []
        print(f"\n{'='*55}")
        print(f"Quality gate: порог={fail_below}")
        for name, scores in score_map.items():
            if not scores:
                continue
            avg = sum(scores) / len(scores)
            status = "✓" if avg >= fail_below else "✗"
            print(f"  [{status}] {name}: avg={avg:.3f}")
            if avg < fail_below:
                failed_metrics.append(f"{name}={avg:.3f}")
        if failed_metrics:
            print(f"\n[QUALITY GATE FAILED] Метрики ниже порога {fail_below}: {', '.join(failed_metrics)}")
            sys.exit(1)
        else:
            print(f"\n[QUALITY GATE PASSED] Все метрики ≥ {fail_below}")

    return run_dir


# ── Programmatic entry point ──────────────────────────────────────────────────

def run_eval(input_path: str, judge_config: dict, max_workers: int = 10,
             threshold: float = 0.7, api_url: str | None = None,
             api_config_dict: dict | None = None,
             limit: int | None = None) -> Path:
    """Run the eval pipeline with externally supplied judge configuration.

    Args:
        input_path:   Path to the input JSON file.
        judge_config: Dict with keys 'provider', 'model', 'name'.
        max_workers:  Number of parallel worker threads.
        threshold:    Pass/fail threshold (0-1).
        api_url:      If set — online mode: fetch fresh answers + chunks from the API (legacy mode).
        api_config_dict: Detailed API contract (dynamic mode).
        limit:        If set — process only the first N records.

    Returns:
        Path к директории с результатами (eval/results/{timestamp}_{dataset})
    """
    global JUDGE_PROVIDER, JUDGE_MODEL_NAME, MAX_WORKERS, THRESHOLD, API_URL, API_CONFIG, LIMIT, API_LOG, ERRORS_LOG  # noqa: PLW0603
    global THRESHOLD_AR, THRESHOLD_FA, THRESHOLD_CP, THRESHOLD_CR, JUDGE_NO_REASONING  # noqa: PLW0603

    API_LOG          = []  # сброс перед каждым прогоном
    ERRORS_LOG       = []  # сброс перед каждым прогоном
    JUDGE_PROVIDER   = judge_config["provider"].lower()
    JUDGE_MODEL_NAME   = judge_config["model"]
    JUDGE_NO_REASONING = judge_config.get("no_reasoning", False)
    MAX_WORKERS      = max_workers
    THRESHOLD        = threshold
    THRESHOLD_AR     = judge_config.get("threshold_ar", 0.7)
    THRESHOLD_FA     = judge_config.get("threshold_fa", 0.8)
    THRESHOLD_CP     = judge_config.get("threshold_cp", 0.7)
    THRESHOLD_CR     = judge_config.get("threshold_cr", 0.6)
    API_URL          = api_url.rstrip("/") if api_url else None
    API_CONFIG       = api_config_dict
    LIMIT            = limit
    
    if API_CONFIG:
        print(f"[+] Динамический API-режим: {API_CONFIG.get('method', 'POST')} {API_CONFIG.get('url')}")
    elif API_URL:
        print(f"[+] Онлайн-режим (Legacy): {API_URL}/api/v1/eval/rag")

    return main(input_path)


if __name__ == "__main__":
    import argparse as _argparse
    _parser = _argparse.ArgumentParser(description="DeepEval RAG evaluation pipeline")
    _parser.add_argument("input", nargs="?", help="Путь к входному JSON файлу")
    _parser.add_argument("--report-only", metavar="RUN_DIR", help="Перегенерировать отчёт из готовой папки прогона")
    _parser.add_argument(
        "--fail-below", type=float, default=None, metavar="THRESHOLD",
        help="CI/CD quality gate: exit code 1 если avg любой метрики < THRESHOLD (например 0.75)"
    )
    _parser.add_argument(
        "--judge", type=str, default=None, metavar="ALIAS",
        help="Переопределить судью по имени из targets.yaml (например gpt4o-mini-or, qwen-72b-or)"
    )
    _args = _parser.parse_args()

    if _args.report_only:
        run_dir = Path(_args.report_only)
        metrics_file = run_dir / "metrics.json"
        if not metrics_file.exists():
            print(f"Файл не найден: {metrics_file}")
            sys.exit(1)
        with open(metrics_file, encoding="utf-8") as f:
            results = json.load(f)
        ts = run_dir.name[:15]
        stem = run_dir.name[16:]
        datasets_dir = run_dir.parent.parent / "datasets"
        candidate = datasets_dir / f"{stem}.json"
        input_path = candidate if candidate.exists() else None
        errors_log_file = run_dir / "errors_log.json"
        if errors_log_file.exists():
            with open(errors_log_file, encoding="utf-8") as _ef:
                _errs = json.load(_ef)
            skipped_count = sum(1 for e in _errs if e.get("stage") == "api")
        else:
            skipped_count = 0
        report_path = generate_report(results, skipped_count, ts, stem,
                                      run_dir / "metrics.json",
                                      run_dir / "metrics.csv",
                                      run_dir,
                                      input_path=input_path)
        print(f"Отчёт перегенерирован → {report_path}")
    elif _args.input:
        main(_args.input, fail_below=_args.fail_below, judge_override=_args.judge)
    else:
        _parser.print_help()
        sys.exit(1)
