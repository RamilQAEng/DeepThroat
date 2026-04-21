import threading
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable
from deepeval.test_case import LLMTestCase
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric, ContextualPrecisionMetric, ContextualRecallMetric

from .judges import build_judge
from .api_utils import fetch_from_api
from .checkpoint import save_checkpoint

def evaluate_record(
    rec: Dict[str, Any], 
    index: int, 
    total: int,
    done: Dict[str, Any], 
    lock: threading.Lock, 
    run_dir: Path,
    judge_config: Dict[str, Any],
    thresholds: Dict[str, float],
    api_config: Optional[Dict[str, Any]] = None,
    api_url: Optional[str] = None,
    api_log: Optional[List[Dict[str, Any]]] = None,
    errors_log: Optional[List[Dict[str, Any]]] = None,
    progress_callback: Optional[Callable] = None
) -> Optional[Dict[str, Any]]:
    """Создаёт свои экземпляры метрик и вычисляет score + reason для записи."""
    try:
        return _evaluate_record_inner(
            rec, index, total, done, lock, run_dir, 
            judge_config, thresholds, api_config, api_url, 
            api_log, errors_log, progress_callback
        )
    except Exception as e:
        import traceback
        rec_id = rec.get("id") or rec.get("session_id") or f"index-{index}"
        error_details = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"

        print(f"\n{'='*80}\n[CRITICAL ERROR] Record {rec_id} failed!\n{'='*80}\n{error_details}\n{'='*80}\n")

        try:
            with open(run_dir / f"error_{rec_id}.txt", "w", encoding="utf-8") as f:
                f.write(f"Record ID: {rec_id}\nQuestion: {rec.get('user_query', '')}\n\n{error_details}")
        except: pass

        if errors_log is not None:
            errors_log.append({"id": rec_id, "error": error_details, "stage": "evaluate_record"})
        return None

def _evaluate_record_inner(
    rec: Dict[str, Any], 
    index: int, 
    total: int,
    done: Dict[str, Any], 
    lock: threading.Lock, 
    run_dir: Path,
    judge_config: Dict[str, Any],
    thresholds: Dict[str, float],
    api_config: Optional[Dict[str, Any]],
    api_url: Optional[str],
    api_log: Optional[List[Dict[str, Any]]],
    errors_log: Optional[List[Dict[str, Any]]],
    progress_callback: Optional[Callable]
) -> Optional[Dict[str, Any]]:
    
    # API Fetch if online mode
    if api_url or api_config:
        try:
            rec = fetch_from_api(rec, api_config, api_url, api_log, lock)
        except Exception as e:
            rec_id = rec.get("id") or rec.get("session_id") or f"index-{index}"
            print(f"[{index}/{total}] API error [{rec_id}]: {e}")
            if errors_log is not None:
                errors_log.append({"id": rec_id, "error": str(e), "stage": "api"})
            return None

    rec_id = rec.get("id") or rec.get("session_id") or f"index-{index}"
    actual_answer = rec.get("actual_answer") or rec.get("actual_output")
    user_query = rec.get("user_query") or rec.get("question")

    if not actual_answer or not user_query:
        print(f"[SKIP] {rec_id}: Missing required fields")
        return None

    rec["actual_answer"] = actual_answer
    rec["user_query"] = user_query

    session_key = str(rec_id)
    if session_key in done:
        print(f"[{index}/{total}] {session_key} — чекпоинт, пропускаем")
        return done[session_key]

    # Metric setup
    context = rec.get("retrieval_context")
    has_context = isinstance(context, list) and len(context) > 0
    expected = rec.get("expected_output") or rec.get("expected_answer") or ""
    has_expected = bool(expected)

    tc = LLMTestCase(
        input=rec["user_query"],
        actual_output=rec["actual_answer"],
        expected_output=expected if has_expected else None,
        retrieval_context=context if has_context else None,
    )

    judge = build_judge(
        provider=judge_config["provider"], 
        model=judge_config["model"], 
        no_reasoning=judge_config.get("no_reasoning", False)
    )

    enabled_metrics = api_config.get("metrics", ["AR", "FA", "CP", "CR"]) if api_config else ["AR", "FA", "CP", "CR"]
    
    res = {
        "id": rec_id, "session_id": rec.get("session_id"), "category": rec.get("category"),
        "user_query": user_query, "expected_answer": expected, "actual_answer": actual_answer
    }

    # Run Metrics (Sequential in this thread)
    metrics_map = {
        "AR": (AnswerRelevancyMetric, "answer_relevancy", True),
        "FA": (FaithfulnessMetric, "faithfulness", has_context),
        "CP": (ContextualPrecisionMetric, "contextual_precision", has_context and has_expected),
        "CR": (ContextualRecallMetric, "contextual_recall", has_context and has_expected)
    }

    for m_id, (m_class, m_prefix, condition) in metrics_map.items():
        if m_id in enabled_metrics and condition:
            try:
                m = m_class(threshold=thresholds.get(m_id, 0.7), model=judge, include_reason=True)
                m.measure(tc)
                res[f"{m_prefix}_score"] = m.score
                res[f"{m_prefix}_passed"] = m.is_successful()
                res[f"{m_prefix}_reason"] = m.reason
            except Exception as e:
                res[f"{m_prefix}_score"], res[f"{m_prefix}_passed"], res[f"{m_prefix}_reason"] = None, False, f"ERROR: {e}"
                if errors_log is not None:
                    errors_log.append({"id": rec_id, "error": str(e), "stage": f"metric_{m_id.lower()}"})
        else:
            res[f"{m_prefix}_score"] = res[f"{m_prefix}_passed"] = None
            res[f"{m_prefix}_reason"] = "skipped"

    # Status log line
    def fmt(v): return f"{v:.3f}" if v is not None else "—"
    print(f"[{index}/{total}] AR={fmt(res.get('answer_relevancy_score'))} FA={fmt(res.get('faithfulness_score'))} CP={fmt(res.get('contextual_precision_score'))} CR={fmt(res.get('contextual_recall_score'))}  {user_query[:40]}")

    with lock:
        done[session_key] = res
    save_checkpoint(run_dir, done, lock)

    if progress_callback:
        try: progress_callback(processed=len(done), total=total, current_id=session_key)
        except: pass

    return res
