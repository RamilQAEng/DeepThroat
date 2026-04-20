"""
Scheduled RAG quality runs with Telegram notifications.

Usage:
    # Run once immediately (for testing):
    python scripts/scheduler.py --run-now

    # Start the cron scheduler (blocks, runs in background):
    python scripts/scheduler.py

    # Custom config:
    python scripts/scheduler.py --config config/scheduler.yaml

    # Override schedule for quick test:
    python scripts/scheduler.py --run-now --limit 3

Environment variables (in .env):
    TELEGRAM_BOT_TOKEN   — bot token from @BotFather
    TELEGRAM_CHAT_ID     — chat or group id (e.g. -100xxxxxxxxx)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import yaml

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
    load_dotenv(Path(__file__).parent.parent / "eval" / ".env")
except ImportError:
    pass

try:
    import httpx
    _HAS_HTTPX = True
except ImportError:
    _HAS_HTTPX = False

try:
    from croniter import croniter
    _HAS_CRONITER = True
except ImportError:
    _HAS_CRONITER = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("scheduler")

PROJECT_ROOT = Path(__file__).parent.parent
DEFAULT_CONFIG = PROJECT_ROOT / "config" / "scheduler.yaml"


# ── Config ────────────────────────────────────────────────────────────────────

def load_config(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


# ── Telegram ──────────────────────────────────────────────────────────────────

async def send_telegram(token: str, chat_id: str, text: str) -> bool:
    """Send a Telegram message. Returns True on success."""
    if not _HAS_HTTPX:
        log.warning("httpx not installed — Telegram notifications disabled. pip install httpx")
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            return True
    except Exception as exc:
        log.error("Telegram send failed: %s", exc)
        return False


def format_telegram_message(
    framework: str,
    dataset: str,
    results_dir: Optional[Path],
    passed: bool,
    metrics_summary: dict[str, float],
    fail_below: float,
    duration_sec: float,
    error: Optional[str] = None,
) -> str:
    status_icon = "✅" if passed else "❌"
    status_text = "PASSED" if passed else "FAILED"
    ts = datetime.now().strftime("%d.%m.%Y %H:%M")

    lines = [
        f"{status_icon} <b>RAG Quality Gate — {status_text}</b>",
        f"📅 {ts}",
        f"🔬 Framework: <code>{framework.upper()}</code>",
        f"📂 Dataset: <code>{Path(dataset).name}</code>",
        f"⚡ Duration: {duration_sec:.0f}s",
        "",
    ]

    if metrics_summary:
        lines.append("📊 <b>Метрики:</b>")
        metric_labels = {
            "answer_relevancy": "Answer Relevancy",
            "faithfulness": "Faithfulness",
            "contextual_precision": "Ctx Precision",
            "contextual_recall": "Ctx Recall",
        }
        for key, val in metrics_summary.items():
            label = metric_labels.get(key, key)
            icon = "✓" if val >= fail_below else "✗"
            pct = f"{val * 100:.1f}%"
            lines.append(f"  {icon} {label}: <b>{pct}</b>")
        lines.append(f"  Порог: {fail_below * 100:.0f}%")

    if error:
        lines.extend(["", f"⚠️ <b>Ошибка:</b>", f"<code>{error[:300]}</code>"])

    if results_dir:
        lines.extend(["", f"📁 <code>{results_dir.name}</code>"])

    return "\n".join(lines)


# ── Run eval ──────────────────────────────────────────────────────────────────

def run_eval(cfg: dict, limit_override: Optional[int] = None) -> tuple[bool, dict[str, float], Optional[Path], Optional[str]]:
    """
    Run the configured eval pipeline as a subprocess.
    Returns: (passed, metrics_summary, results_dir, error_message)
    """
    framework = cfg.get("framework", "ragas").lower()
    dataset = cfg.get("dataset", "eval/datasets/dataset.json")
    fail_below = cfg.get("fail_below", 0.70)
    limit = limit_override if limit_override is not None else cfg.get("limit")

    dataset_path = PROJECT_ROOT / dataset
    if not dataset_path.exists():
        return False, {}, None, f"Dataset not found: {dataset_path}"

    if framework in ("ragas", "both"):
        script = PROJECT_ROOT / "eval" / "eval_ragas_metrics.py"
    else:
        script = PROJECT_ROOT / "eval" / "eval_rag_metrics.py"

    cmd = [sys.executable, str(script), str(dataset_path), f"--fail-below={fail_below}"]
    if limit:
        cmd.append(f"--limit={limit}")

    log.info("Running: %s", " ".join(cmd))
    t0 = time.time()

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(PROJECT_ROOT / "eval"),
        )
        duration = time.time() - t0
        log.info("Exit code: %d, duration: %.1fs", result.returncode, duration)

        if result.stdout:
            log.info("stdout:\n%s", result.stdout[-2000:])
        if result.stderr:
            log.warning("stderr:\n%s", result.stderr[-1000:])

        # Parse metrics from stdout
        metrics_summary: dict[str, float] = {}
        for line in result.stdout.splitlines():
            for key in ("answer_relevancy", "faithfulness", "contextual_precision", "contextual_recall"):
                if key in line and "avg=" in line:
                    try:
                        avg_part = line.split("avg=")[1].split()[0].rstrip(",")
                        metrics_summary[key] = float(avg_part)
                    except (IndexError, ValueError):
                        pass

        # Find latest results dir
        results_base = PROJECT_ROOT / "eval" / "results"
        results_dir = None
        if results_base.exists():
            candidates = sorted(
                [d for d in results_base.iterdir() if d.is_dir()],
                key=lambda d: d.stat().st_mtime,
                reverse=True,
            )
            if candidates:
                results_dir = candidates[0]

        passed = result.returncode == 0
        error = None if passed else f"Exit {result.returncode}"
        return passed, metrics_summary, results_dir, error

    except Exception as exc:
        return False, {}, None, str(exc)


# ── Notification dispatch ──────────────────────────────────────────────────────

async def notify(cfg: dict, passed: bool, metrics: dict, results_dir: Optional[Path],
                 error: Optional[str], duration: float) -> None:
    notif_cfg = cfg.get("notifications", {})
    tg_cfg = notif_cfg.get("telegram", {})

    if not tg_cfg.get("enabled", False):
        return

    should_notify = (
        (not passed and tg_cfg.get("on_failure", True))
        or (passed and tg_cfg.get("on_success", True))
        or tg_cfg.get("always_notify", False)
    )
    if not should_notify:
        return

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")

    if not token or not chat_id:
        log.warning("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping notification")
        return

    message = format_telegram_message(
        framework=cfg.get("framework", "ragas"),
        dataset=cfg.get("dataset", ""),
        results_dir=results_dir,
        passed=passed,
        metrics_summary=metrics,
        fail_below=cfg.get("fail_below", 0.70),
        duration_sec=duration,
        error=error,
    )

    ok = await send_telegram(token, chat_id, message)
    if ok:
        log.info("Telegram notification sent")


# ── Main loop ─────────────────────────────────────────────────────────────────

async def run_once(cfg: dict, limit_override: Optional[int] = None) -> bool:
    log.info("Starting eval run...")
    t0 = time.time()
    passed, metrics, results_dir, error = run_eval(cfg, limit_override=limit_override)
    duration = time.time() - t0
    await notify(cfg, passed, metrics, results_dir, error, duration)
    status = "PASSED" if passed else "FAILED"
    log.info("Run complete: %s in %.1fs", status, duration)
    return passed


async def scheduler_loop(cfg: dict) -> None:
    if not _HAS_CRONITER:
        log.error("croniter not installed. pip install croniter")
        sys.exit(1)

    cron_expr = cfg.get("schedule", "0 9 * * *")
    log.info("Scheduler started. Cron: '%s'", cron_expr)
    log.info("Next runs:")
    cron = croniter(cron_expr, datetime.now())
    for _ in range(3):
        log.info("  %s", cron.get_next(datetime).strftime("%Y-%m-%d %H:%M"))

    while True:
        cron = croniter(cron_expr, datetime.now())
        next_run = cron.get_next(datetime)
        wait_sec = (next_run - datetime.now()).total_seconds()
        log.info("Next run at %s (in %.0f seconds)", next_run.strftime("%H:%M"), wait_sec)
        await asyncio.sleep(max(0, wait_sec))
        await run_once(cfg)


def main() -> None:
    parser = argparse.ArgumentParser(description="Scheduled RAG quality runner with Telegram alerts")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Path to scheduler.yaml")
    parser.add_argument("--run-now", action="store_true", help="Run once immediately and exit")
    parser.add_argument("--limit", type=int, default=None, help="Override record limit for this run")
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.exists():
        log.error("Config not found: %s", config_path)
        sys.exit(1)

    cfg = load_config(config_path)

    if args.run_now:
        passed = asyncio.run(run_once(cfg, limit_override=args.limit))
        sys.exit(0 if passed else 1)
    else:
        asyncio.run(scheduler_loop(cfg))


if __name__ == "__main__":
    main()
