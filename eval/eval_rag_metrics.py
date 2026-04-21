"""
Pipeline: Answer Relevancy + Faithfulness (DeepEval) — Orchestrator
==================================================================
Modularized version of the evaluation pipeline.
"""

import csv
import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Callable

import yaml
from core.checkpoint import load_checkpoint

# Import our new core modules
from core.reporting import generate_markdown_report
from core.runner import evaluate_record
from dotenv import load_dotenv

# Load environment
load_dotenv(Path(__file__).parent / ".env")

# ── Конфигурация ──────────────────────────────────────────────────────────────
THRESHOLD_DEFAULTS = {"AR": 0.7, "FA": 0.8, "CP": 0.7, "CR": 0.6}
MAX_WORKERS = 3
API_CONFIG: dict | None = None
PROGRESS_CALLBACK: Callable | None = None
API_LOG: list = []
ERRORS_LOG: list = []
API_LOG_LOCK = threading.Lock()

OUTPUT_DIR = Path(__file__).parent / "results"
OUTPUT_DIR.mkdir(exist_ok=True)
TARGETS_PATH = Path(__file__).parent / "config" / "targets.yaml"


def _resolve_judge(alias: str) -> dict:
    if not TARGETS_PATH.exists():
        raise ValueError(f"targets.yaml not found: {TARGETS_PATH}")
    with open(TARGETS_PATH, encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    targets = {t["name"]: t for t in cfg.get("targets", [])}
    if alias not in targets:
        raise ValueError(f"Judge '{alias}' not in targets.yaml")
    t = targets[alias]
    return {
        "provider": t["provider"].lower(),
        "model": t["model"],
        "name": alias,
        "no_reasoning": t.get("no_reasoning", False),
    }


def run_eval(
    input_path: str,
    limit: int | None = None,
    judge_config: str | None = None,
    api_contract: dict | None = None,
    metrics: list[str] | None = None,
    progress_callback: Callable | None = None,
    workers: int | None = None,
    thresholds: dict | None = None,
) -> Path:
    """Основная точка входа для запуска оценки."""
    global API_CONFIG, PROGRESS_CALLBACK, MAX_WORKERS, THRESHOLD_DEFAULTS

    # Initialize API_CONFIG if it's None to avoid errors when setting metrics
    if api_contract is None:
        api_contract = {}

    if metrics:
        api_contract["metrics"] = metrics

    API_CONFIG = api_contract
    PROGRESS_CALLBACK = progress_callback
    if workers:
        MAX_WORKERS = workers
    if thresholds:
        THRESHOLD_DEFAULTS = thresholds

    # 1. Setup Judge
    judge_name = judge_config or os.getenv("JUDGE_ALIAS", "openai")
    try:
        judge_cfg = _resolve_judge(judge_name)
    except Exception as e:
        print(f"[ERROR] Judge setup failed: {e}")
        # fallback to env
        judge_cfg = {
            "provider": os.getenv("JUDGE_PROVIDER", "openai").lower(),
            "model": os.getenv("JUDGE_MODEL", "gpt-4o-mini"),
            "no_reasoning": False,
        }

    # 2. Setup Files
    path = Path(input_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_name = f"{ts}_{path.stem}"
    run_dir = OUTPUT_DIR / run_name
    run_dir.mkdir(parents=True, exist_ok=True)

    # 3. Load Data
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if limit:
        data = data[:limit]

    done = load_checkpoint(run_dir)
    lock = threading.Lock()

    print(f"\n[+] Dataset   : {path}")
    print(f"[+] Judge     : {judge_cfg['provider']} / {judge_cfg['model']}")
    print(f"[+] Workers   : {MAX_WORKERS}")
    print(f"[+] Thresholds: {THRESHOLD_DEFAULTS}")
    print(f"[+] Samples   : {len(data)}")
    print(f"[+] Output    : {run_dir}\n")

    # 4. Processing
    from core.judges import build_judge

    judge_obj = build_judge(
        provider=judge_cfg["provider"],
        model=judge_cfg["model"],
        no_reasoning=judge_cfg.get("no_reasoning", False),
    )

    results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(
                evaluate_record, rec, i + 1, len(data), done, lock, run_dir, judge_obj, THRESHOLD_DEFAULTS, API_CONFIG
            ): rec
            for i, rec in enumerate(data)
        }
        for future in as_completed(futures):
            res = future.result()
            if res:
                results.append(res)

    # 5. Save Artifacts
    if API_LOG:
        with open(run_dir / "api_responses.json", "w", encoding="utf-8") as f:
            json.dump(API_LOG, f, ensure_ascii=False, indent=2)

    if ERRORS_LOG:
        with open(run_dir / "errors_log.json", "w", encoding="utf-8") as f:
            json.dump(ERRORS_LOG, f, ensure_ascii=False, indent=2)

    metrics_json = run_dir / "metrics.json"
    with open(metrics_json, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # Simple CSV export
    metrics_csv = run_dir / "metrics.csv"
    if results:
        with open(metrics_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)

    # 6. Report
    report_path = generate_markdown_report(
        results,
        len(data) - len(results),
        ts,
        judge_cfg["provider"],
        judge_cfg["model"],
        path.stem,
        run_dir,
        THRESHOLD_DEFAULTS,
        path,
    )

    print(f"\n[DONE] Report saved to: {report_path}")
    return run_dir


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="Path to input JSON dataset")
    parser.add_argument("--limit", type=int, help="Limit samples")
    parser.add_argument("--judge", help="Judge alias from targets.yaml")
    args = parser.parse_args()

    try:
        run_eval(args.input, limit=args.limit, judge_config=args.judge)
    except Exception as e:
        print(f"[FATAL] {e}")
        sys.exit(1)
