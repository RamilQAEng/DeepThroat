import threading
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from deepeval.metrics import (
    AnswerRelevancyMetric,
    ContextualPrecisionMetric,
    ContextualRecallMetric,
    FaithfulnessMetric,
)
from deepeval.test_case import LLMTestCase

from .api_utils import fetch_from_api
from .checkpoint import save_checkpoint

# Thread-local storage for metrics to avoid re-initialization logs
_thread_local = threading.local()


def _get_metrics(thresholds: Dict[str, float], judge: Any) -> Dict[str, Any]:
    if not hasattr(_thread_local, "metrics"):
        # Initialize metrics once per thread
        _thread_local.metrics = {
            "AR": AnswerRelevancyMetric(threshold=thresholds.get("AR", 0.7), model=judge, include_reason=True),
            "FA": FaithfulnessMetric(threshold=thresholds.get("FA", 0.8), model=judge, include_reason=True),
            "CP": ContextualPrecisionMetric(threshold=thresholds.get("CP", 0.7), model=judge, include_reason=True),
            "CR": ContextualRecallMetric(threshold=thresholds.get("CR", 0.6), model=judge, include_reason=True),
        }
    return _thread_local.metrics


def evaluate_record(
    rec: Dict[str, Any],
    index: int,
    total: int,
    done: Dict[str, Any],
    lock: threading.Lock,
    run_dir: Path,
    judge: Any,  # Now accepts judge object directly
    thresholds: Dict[str, float],
    api_config: Optional[Dict[str, Any]] = None,
    api_url: Optional[str] = None,
    api_log: Optional[List[Dict[str, Any]]] = None,
    errors_log: Optional[List[Dict[str, Any]]] = None,
    progress_callback: Optional[Callable] = None,
) -> Optional[Dict[str, Any]]:
    """Использует кешированные в потоке метрики для оценки записи."""
    try:
        return _evaluate_record_inner(
            rec,
            index,
            total,
            done,
            lock,
            run_dir,
            judge,
            thresholds,
            api_config,
            api_url,
            api_log,
            errors_log,
            progress_callback,
        )
    except Exception as e:
        # ... (rest of error handling is the same)
        import traceback

        rec_id = rec.get("id") or rec.get("session_id") or f"index-{index}"
        error_details = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        print(f"\n[CRITICAL ERROR] Record {rec_id} failed: {error_details}")
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
    judge: Any,
    thresholds: Dict[str, float],
    api_config: Optional[Dict[str, Any]],
    api_url: Optional[str],
    api_log: Optional[List[Dict[str, Any]]],
    errors_log: Optional[List[Dict[str, Any]]],
    progress_callback: Optional[Callable],
) -> Optional[Dict[str, Any]]:
    # ... (API Fetch same)
    if api_url or api_config:
        try:
            rec = fetch_from_api(rec, api_config, api_url, api_log, lock)
        except Exception as e:
            rec_id = rec.get("id") or rec.get("session_id") or f"index-{index}"
            if errors_log is not None:
                errors_log.append({"id": rec_id, "error": str(e), "stage": "api"})
            return None

    rec_id = rec.get("id") or rec.get("session_id") or f"index-{index}"
    actual_answer = rec.get("actual_answer") or rec.get("actual_output")
    user_query = rec.get("user_query") or rec.get("question")

    if not actual_answer or not user_query:
        return None

    rec["actual_answer"] = actual_answer
    rec["user_query"] = user_query

    session_key = str(rec_id)
    if session_key in done:
        return done[session_key]

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

    enabled_metrics = api_config.get("metrics", ["AR", "FA", "CP", "CR"]) if api_config else ["AR", "FA", "CP", "CR"]

    # Get thread-local metrics
    cached_metrics = _get_metrics(thresholds, judge)

    res = {
        "id": rec_id,
        "session_id": rec.get("session_id"),
        "category": rec.get("category"),
        "user_query": user_query,
        "expected_answer": expected,
        "actual_answer": actual_answer,
    }

    # Run Metrics
    metrics_config = {
        "AR": ("answer_relevancy", True),
        "FA": ("faithfulness", has_context),
        "CP": ("contextual_precision", has_context and has_expected),
        "CR": ("contextual_recall", has_context and has_expected),
    }

    for m_id, (m_prefix, condition) in metrics_config.items():
        if m_id in enabled_metrics and condition:
            try:
                m = cached_metrics[m_id]
                m.measure(tc)
                res[f"{m_prefix}_score"] = m.score
                res[f"{m_prefix}_passed"] = m.is_successful()
                res[f"{m_prefix}_reason"] = m.reason
            except Exception as e:
                res[f"{m_prefix}_score"], res[f"{m_prefix}_passed"], res[f"{m_prefix}_reason"] = (
                    None,
                    False,
                    f"ERROR: {e}",
                )
                if errors_log is not None:
                    errors_log.append({"id": rec_id, "error": str(e), "stage": f"metric_{m_id.lower()}"})
        else:
            res[f"{m_prefix}_score"] = res[f"{m_prefix}_passed"] = None
            res[f"{m_prefix}_reason"] = "skipped"

    # Status log line
    def fmt(v):
        return f"{v:.3f}" if v is not None else "—"

    print(
        f"[{index}/{total}] AR={fmt(res.get('answer_relevancy_score'))} FA={fmt(res.get('faithfulness_score'))} CP={fmt(res.get('contextual_precision_score'))} CR={fmt(res.get('contextual_recall_score'))}  {user_query[:40]}"
    )

    with lock:
        done[session_key] = res
    save_checkpoint(run_dir, done, lock)

    if progress_callback:
        try:
            progress_callback(processed=len(done), total=total, current_id=session_key)
        except Exception:
            pass

    return res
