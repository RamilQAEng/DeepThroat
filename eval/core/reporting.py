import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from collections import defaultdict

def format_reason(reason: Optional[str]) -> str:
    """Заменяет английский префикс DeepEval 'The score is X because Y' на 'Оценка X: Y'."""
    if not reason:
        return "—"
    m = re.match(r"The score is ([\d.]+) because (.+)", reason, re.DOTALL)
    if m:
        return f"Оценка {m.group(1)}: {m.group(2).strip()}"
    return reason

def generate_markdown_report(
    results: List[Dict[str, Any]], 
    skipped: int, 
    timestamp: str,
    judge_provider: str,
    judge_model: str,
    stem: str, 
    run_dir: Path, 
    thresholds: Dict[str, float],
    input_path: Optional[Path] = None
) -> Path:
    """Генерирует Markdown-отчет по результатам прогона."""
    
    ar_scores = [r["answer_relevancy_score"]      for r in results if r["answer_relevancy_score"]      is not None]
    fa_scores = [r["faithfulness_score"]           for r in results if r["faithfulness_score"]           is not None]
    cp_scores = [r["contextual_precision_score"]   for r in results if r.get("contextual_precision_score") is not None]
    cr_scores = [r["contextual_recall_score"]      for r in results if r.get("contextual_recall_score")    is not None]

    def mean(vals): return sum(vals) / len(vals) if vals else 0
    def passed_count(vals, threshold): return sum(1 for v in vals if v >= threshold)
    def score_icon(v, threshold): return "🟢" if v >= threshold else ("🟡" if v >= 0.5 else "🔴")

    # Группировка по категории
    by_category = defaultdict(list)
    for r in results:
        by_category[r["category"]].append(r)

    lines = []
    ts = timestamp
    api_log_path = run_dir / "api_responses.json"

    # Заголовок
    lines += [
        f"# Отчёт по качеству RAG — {ts[:8]}",
        "",
        f"**Дата прогона:** {ts[:4]}-{ts[4:6]}-{ts[6:8]} {ts[9:11]}:{ts[11:13]}:{ts[13:15]}",
        f"**Судья:** {judge_provider} / {judge_model}",
        "",
        "## Файлы прогона",
        "",
        "| Файл | Описание |",
        "|---|---|",
        f"| [{stem}.json]({input_path}) | Датасет |" if input_path else f"| `{stem}` | Датасет |",
        f"| [api_responses.json](api_responses.json) | Ответы RAG-системы |" if api_log_path.exists() else "",
        f"| [metrics.json](metrics.json) | Детальные результаты JSON |",
        f"| [metrics.csv](metrics.csv) | Таблица CSV |",
        f"| [errors_log.json](errors_log.json) | Ошибки прогона |",
        "",
    ]
    lines = [l for l in lines if l != ""] # Cleanup empty lines in table
    lines.append("")

    # Общие метрики
    total = len(results)
    lines += ["## Общий результат", ""]
    lines += ["| Метрика | Вычислено | Среднее | Pass | Pass% | Порог |",
              "|---|---|---|---|---|---|"]
    
    t_ar = thresholds.get("AR", 0.7)
    t_fa = thresholds.get("FA", 0.7)
    t_cp = thresholds.get("CP", 0.7)
    t_cr = thresholds.get("CR", 0.7)

    if ar_scores:
        p = passed_count(ar_scores, t_ar)
        lines.append(f"| Answer Relevancy (AR) | {len(ar_scores)}/{total} | **{mean(ar_scores):.3f}** | {p}/{len(ar_scores)} | **{p/len(ar_scores)*100:.0f}%** | {t_ar} |")
    if fa_scores:
        p = passed_count(fa_scores, t_fa)
        lines.append(f"| Faithfulness (FA) | {len(fa_scores)}/{total} | **{mean(fa_scores):.3f}** | {p}/{len(fa_scores)} | **{p/len(fa_scores)*100:.0f}%** | {t_fa} |")
    if cp_scores:
        p = passed_count(cp_scores, t_cp)
        lines.append(f"| Contextual Precision (CP) | {len(cp_scores)}/{total} | **{mean(cp_scores):.3f}** | {p}/{len(cp_scores)} | **{p/len(cp_scores)*100:.0f}%** | {t_cp} |")
    if cr_scores:
        p = passed_count(cr_scores, t_cr)
        lines.append(f"| Contextual Recall (CR) | {len(cr_scores)}/{total} | **{mean(cr_scores):.3f}** | {p}/{len(cr_scores)} | **{p/len(cr_scores)*100:.0f}%** | {t_cr} |")

    lines += ["", f"> Обработано: **{len(results)}** записей, пропущено: **{skipped}**", ""]

    # Категории
    lines += ["## Результаты по категориям", ""]
    lines += ["| Категория | Записей | AR среднее | AR pass% |",
              "|---|---|---|---|"]
    for cat, recs in sorted(by_category.items()):
        cat_ar = [r["answer_relevancy_score"] for r in recs if r["answer_relevancy_score"] is not None]
        if cat_ar:
            p_pct = passed_count(cat_ar, t_ar) / len(cat_ar) * 100
            lines.append(f"| {cat} | {len(recs)} | {mean(cat_ar):.3f} | {p_pct:.0f}% |")
    lines.append("")

    # Детали
    lines += ["## Детальные результаты", ""]
    for r in results:
        ar = r["answer_relevancy_score"]
        ar_str = f"{ar:.3f}" if ar is not None else "—"
        icon = score_icon(ar, t_ar) if ar is not None else "⚪"
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
            f"| Answer Relevancy     | {ar_str} | {'✅' if r['answer_relevancy_passed'] else '❌'} |",
        ]
        if fa is not None:
            lines.append(f"| Faithfulness         | {fa_str} | {'✅' if r['faithfulness_passed'] else '❌'} |")
        
        for m_key, m_label, t_val in [("contextual_precision", "Contextual Precision", t_cp), 
                                      ("contextual_recall", "Contextual Recall", t_cr)]:
            score = r.get(f"{m_key}_score")
            if score is not None:
                lines.append(f"| {m_label} | {score:.3f} | {'✅' if r.get(f'{m_key}_passed') else '❌'} |")

        lines += ["", "**Комментарии судьи:**", ""]
        lines.append(f"> **AR:** {format_reason(r['answer_relevancy_reason'])}")
        
        for m_key in ["faithfulness", "contextual_precision", "contextual_recall"]:
            reason = r.get(f"{m_key}_reason")
            if reason:
                lines.append("")
                lines.append(f"> **{m_key.upper().replace('CONTEXTUAL_', 'C')}:** {format_reason(reason)}")
        
        lines += ["", "---", ""]

    report_path = run_dir / "report.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path
