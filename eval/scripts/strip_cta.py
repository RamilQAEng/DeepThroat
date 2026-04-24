#!/usr/bin/env python3
"""Convert api_responses.json → offline eval dataset with CTA suffixes stripped.

Usage:
    # Шаг 1: конвертация (файл с таймстампом сохранится рядом с api_responses.json)
    python eval/scripts/strip_cta.py \\
        eval/results/<run_dir>/api_responses.json

    # Шаг 2: офлайн-прогон (API не вызывается, только метрики)
    python eval/scripts/run_eval.py \\
        --input eval/results/<run_dir>/<timestamp>_stripped_dataset.json \\
        --judge deepseek-v3

    # Другие доступные судьи:
    #   qwen-72b-or     — рекомендуемый (качество/цена)
    #   qwen-235b-or    — максимальное качество
    #   gpt4o-or        — GPT-4o
    #   gpt4o-mini-or   — GPT-4o-mini (быстрый)
    #   deepseek-v3     — DeepSeek V3.2
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

# Add any CTA patterns the bot uses at the end of answers
_CTA_RE = re.compile(
    r"[\s\n]*(Чем\s+я\s+(?:ещё|еще)\s+могу\s+помочь\??"
    r"|Чем\s+(?:ещё|еще)\s+могу\s+помочь\??"
    r"|Чем\s+могу\s+помочь\??"
    r"|Могу\s+ли\s+я\s+(?:ещё|еще)\s+чем[- ]то\s+помочь\??"
    r"|Есть\s+ли\s+у\s+вас\s+(?:ещё|еще)\s+вопросы\??"
    r")[\s\n]*$",
    re.IGNORECASE,
)


def strip_cta(text: str) -> str:
    return _CTA_RE.sub("", text).rstrip() if text else text


def convert(src: Path, dst: Path) -> None:
    with open(src, encoding="utf-8") as f:
        responses = json.load(f)

    dataset = []
    stripped_count = 0

    for rec in responses:
        raw_answer = rec.get("answer", "")
        clean_answer = strip_cta(raw_answer)
        if clean_answer != raw_answer:
            stripped_count += 1

        chunks = rec.get("retrieved_chunks", [])
        retrieval_context = [c["content"] if isinstance(c, dict) and "content" in c else str(c) for c in chunks]

        dataset.append(
            {
                "id": rec.get("id") or rec.get("session_id"),
                "session_id": rec.get("session_id") or rec.get("id"),
                "question": rec.get("question") or rec.get("user_query", ""),
                "user_query": rec.get("question") or rec.get("user_query", ""),
                "category": rec.get("category", ""),
                "expected_answer": rec.get("expected_answer") or rec.get("expected_output", ""),
                "actual_answer": clean_answer,
                "retrieval_context": retrieval_context,
            }
        )

    dst.parent.mkdir(parents=True, exist_ok=True)
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    print(f"[+] {len(dataset)} записей → {dst}")
    print(f"[+] Stripped CTA from {stripped_count}/{len(dataset)} answers")


def main() -> None:
    parser = argparse.ArgumentParser(description="Strip CTA suffixes and convert api_responses.json to eval dataset")
    parser.add_argument("input", help="Path to api_responses.json")
    parser.add_argument(
        "--output", default=None, help="Output dataset path (default: same dir as input, stripped_dataset.json)"
    )
    args = parser.parse_args()

    src = Path(args.input)
    if not src.exists():
        print(f"[!] File not found: {src}", file=sys.stderr)
        sys.exit(1)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = Path(args.output) if args.output else src.parent / f"{ts}_stripped_dataset.json"
    convert(src, dst)


if __name__ == "__main__":
    main()
