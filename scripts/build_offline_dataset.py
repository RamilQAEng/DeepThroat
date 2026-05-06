#!/usr/bin/env python3
"""
Populate a dataset with real API responses (actual_output + retrieval_context).

Sends each question to the RAG API, saves the enriched records to an offline
dataset that can be re-evaluated without hitting the API again.

Usage:
    python scripts/build_offline_dataset.py --input eval/datasets/20260504_manjerok_dining_dataset.json
    python scripts/build_offline_dataset.py --input eval/datasets/20260504_manjerok_spa_fitness_dataset.json --output eval/datasets/my_offline.json
    python scripts/build_offline_dataset.py --input eval/datasets/20260504_manjerok_dining_dataset.json --workers 5
"""
import argparse
import json
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).parent.parent / "eval"))

from core.api_utils import fetch_from_api

BASE_URL = "https://assist.dev.mglk.ru/api/v1/eval/rag"

API_CONFIG = {
    "url": BASE_URL,
    "method": "POST",
    "headers": {},
    "body": {
        "question": "{{user_query}}",
        "category": "{{category}}",
    },
    "extractors": {
        "answer": "answer",
        "chunks": "retrieved_chunks",
    },
}


def _enrich_record(
    rec: dict,
    index: int,
    total: int,
    lock: threading.Lock,
    api_log: list,
    errors: list,
) -> dict | None:
    rec_id = rec.get("id", f"index-{index}")
    try:
        enriched = fetch_from_api(rec, API_CONFIG, api_log=api_log, log_lock=lock)
        chunks_count = len(enriched.get("retrieval_context") or [])
        answer_preview = (enriched.get("actual_output") or "")[:60].replace("\n", " ")
        print(f"[{index}/{total}] {rec_id} — chunks={chunks_count} answer={answer_preview!r}")
        return enriched
    except Exception as e:
        error_msg = str(e)
        print(f"[{index}/{total}] {rec_id} — ERROR: {error_msg}", file=sys.stderr)
        with lock:
            errors.append({"id": rec_id, "index": index, "error": error_msg, "record": rec})
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich dataset with live API responses.")
    parser.add_argument("--input", required=True, help="Input dataset JSON")
    parser.add_argument(
        "--output",
        default=None,
        help="Output path (default: <input_stem>_offline_<date>.json)",
    )
    parser.add_argument("--workers", type=int, default=3, help="Parallel workers (default: 3)")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"ERROR: input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    with open(input_path, encoding="utf-8") as f:
        records: list[dict] = json.load(f)

    today = datetime.now().strftime("%Y%m%d")
    output_path = Path(args.output) if args.output else input_path.parent / f"{input_path.stem}_offline_{today}.json"

    total = len(records)
    print(f"[+] Input:   {input_path} ({total} records)")
    print(f"[+] Output:  {output_path}")
    print(f"[+] Workers: {args.workers}")
    print(f"[+] API:     {BASE_URL}\n")

    lock = threading.Lock()
    api_log: list = []
    errors: list = []
    results: dict[int, dict] = {}

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(_enrich_record, rec, i + 1, total, lock, api_log, errors): i
            for i, rec in enumerate(records)
        }
        for future in as_completed(futures):
            idx = futures[future]
            result = future.result()
            if result is not None:
                results[idx] = result

    enriched_records = [results[i] for i in sorted(results)]
    skipped = total - len(enriched_records)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(enriched_records, f, ensure_ascii=False, indent=2)

    print(f"\n[+] Done — {len(enriched_records)}/{total} records saved → {output_path}")
    if skipped:
        errors_path = output_path.parent / f"{output_path.stem}_errors.json"
        with open(errors_path, "w", encoding="utf-8") as f:
            json.dump(errors, f, ensure_ascii=False, indent=2)
        print(f"[!] Skipped {skipped} records due to API errors → {errors_path}")


if __name__ == "__main__":
    main()
