"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
    Activity, ShieldCheck, LayoutGrid, Target, CheckCircle,
    Rocket, FileText, Sparkles, Star, Download, ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Provider Comparison types ─────────────────────────────────────────────────
interface JudgeRun { dir: string; timestamp: string; total_records: number; metrics: Record<string, number>; }
interface JudgeEntry { name: string; model: string; provider: string; runs: JudgeRun[]; avg: Record<string, number>; }
interface ProvidersData { judges: JudgeEntry[]; score_keys: string[]; }

const METRIC_SHORT: Record<string, string> = {
    faithfulness_score:       "Faithfulness",
    answer_relevancy_score:   "Ans Relevancy",
    context_precision_score:  "Ctx Precision",
    context_recall_score:     "Ctx Recall",
    answer_correctness_score: "Ans Correctness",
};

function ProviderComparisonSection() {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<ProvidersData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        if (data || loading) return;
        setLoading(true);
        fetch("/api/eval/providers")
            .then(r => r.json())
            .then((d: ProvidersData) => { setData(d); setLoading(false); })
            .catch(e => { setError(e.message); setLoading(false); });
    };

    const toggle = () => { setOpen(o => !o); if (!open) load(); };

    const { judges = [], score_keys = [] } = data ?? {};
    const presentKeys = score_keys.length > 0 ? score_keys : Object.keys(METRIC_SHORT);

    // Find best judge per metric
    const bestJudge: Record<string, string> = {};
    for (const key of presentKeys) {
        let best: JudgeEntry | null = null;
        for (const j of judges) {
            if (j.avg[key] != null && (best == null || j.avg[key] > best.avg[key])) best = j;
        }
        if (best) bestJudge[key] = best.name;
    }

    return (
        <div className="border border-[#e5e7eb] rounded-2xl overflow-hidden">
            <button
                onClick={toggle}
                className="w-full flex items-center justify-between px-6 py-4 bg-white hover:bg-[#f9fafb] transition-colors text-left"
            >
                <span className="text-sm font-semibold text-[#222222]">Сравнение провайдеров</span>
                <ChevronDown className={`h-4 w-4 text-[#8e8e93] transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="px-6 pb-6 bg-white border-t border-[#f0f0f0]">
                    {loading && <p className="text-sm text-[#8e8e93] pt-4">Загрузка…</p>}
                    {error && <p className="text-sm text-red-500 pt-4">{error}</p>}

                    {!loading && !error && judges.length === 0 && (
                        <div className="pt-4 space-y-2 text-sm text-[#555]">
                            <p>Нет прогонов с тегом провайдера.</p>
                            <p className="font-mono text-xs bg-[#f5f5f5] rounded px-3 py-2 whitespace-pre">
                                {`python eval/run_provider_comparison.py \\\n  eval/datasets/dataset.json \\\n  --judges gpt4o-mini-or,qwen-72b-or \\\n  --limit 5`}
                            </p>
                        </div>
                    )}

                    {!loading && judges.length > 0 && (
                        <div className="pt-4 overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr>
                                        <th className="text-left text-xs font-semibold text-[#8e8e93] uppercase tracking-wide py-2 pr-4 w-40">Метрика</th>
                                        {judges.map(j => (
                                            <th key={j.name} className="text-center text-xs font-semibold text-[#222222] py-2 px-3 min-w-[110px]">
                                                <div>{j.name}</div>
                                                <div className="text-[#8e8e93] font-normal normal-case tracking-normal">{j.model.split("/").pop()}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {presentKeys.map(key => (
                                        <tr key={key} className="border-t border-[#f0f0f0]">
                                            <td className="py-2 pr-4 text-[#444] text-xs font-medium">
                                                {METRIC_SHORT[key] ?? key}
                                            </td>
                                            {judges.map(j => {
                                                const val = j.avg[key];
                                                const isBest = bestJudge[key] === j.name;
                                                const pct = val != null ? `${(val * 100).toFixed(1)}%` : "—";
                                                const color = val == null ? "text-[#ccc]"
                                                    : val >= 0.7 ? "text-emerald-600"
                                                    : val >= 0.5 ? "text-amber-600"
                                                    : "text-red-500";
                                                return (
                                                    <td key={j.name} className={`py-2 px-3 text-center text-sm font-semibold ${color} ${isBest ? "bg-emerald-50 rounded" : ""}`}>
                                                        {pct}{isBest && val != null ? " ★" : ""}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    <tr className="border-t-2 border-[#e5e7eb]">
                                        <td className="py-2 pr-4 text-[#888] text-xs font-semibold uppercase tracking-wide">Прогонов</td>
                                        {judges.map(j => (
                                            <td key={j.name} className="py-2 px-3 text-center text-xs text-[#8e8e93]">{j.runs.length}</td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const PASS_THRESHOLD = 0.7;

// ── Реестр метрик: иконка, цвет, описание ─────────────────────────────────────
interface MetricMeta {
    label:       string;
    description: string;
    icon:        LucideIcon;
    color:       string; // Tailwind color name (pink, cyan, …)
    hexColor:    string; // для score-bars где нужен inline style
}

const METRIC_META: Record<string, MetricMeta> = {
    faithfulness_score: {
        label:       "Faithfulness",
        description: "Доля утверждений в ответе, подтверждённых контекстом",
        icon:        ShieldCheck,
        color:       "pink",
        hexColor:    "#be185d",
    },
    context_precision_score: {
        label:       "Ctx Precision",
        description: "Релевантные чанки идут первыми — точность ранжирования",
        icon:        LayoutGrid,
        color:       "cyan",
        hexColor:    "#0e7490",
    },
    context_recall_score: {
        label:       "Ctx Recall",
        description: "Покрытие эталонного ответа извлечёнными чанками",
        icon:        Target,
        color:       "violet",
        hexColor:    "#6d28d9",
    },
    answer_correctness_score: {
        label:       "Ans Correct",
        description: "Фактическая близость ответа к эталону",
        icon:        CheckCircle,
        color:       "emerald",
        hexColor:    "#059669",
    },
    answer_relevancy_score: {
        label:       "Ans Relevancy",
        description: "Соответствие ответа вопросу (нужен OPENAI_API_KEY для embeddings)",
        icon:        Activity,
        color:       "blue",
        hexColor:    "#2563eb",
    },
    completeness_score: {
        label:       "Completeness",
        description: "Насколько полно ответ покрывает вопрос пользователя",
        icon:        FileText,
        color:       "orange",
        hexColor:    "#ea580c",
    },
    resort_tone_score: {
        label:       "Resort Tone",
        description: "Тон 5★ курорта: тепло, профессионально, без канцелярщины",
        icon:        Star,
        color:       "yellow",
        hexColor:    "#ca8a04",
    },
};

// Фиксированный порядок стандартных метрик в KPI-сетке
const STANDARD_ORDER = [
    "faithfulness_score",
    "context_precision_score",
    "context_recall_score",
    "answer_correctness_score",
    "answer_relevancy_score",
] as const;

function getMetaForKey(key: string): MetricMeta {
    if (METRIC_META[key]) return METRIC_META[key];
    const label = key
        .replace(/_score$/, "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    return {
        label,
        description: "Кастомная метрика",
        icon:        Sparkles,
        color:       "slate",
        hexColor:    "#64748b",
    };
}

// ── Типы данных ───────────────────────────────────────────────────────────────

interface RagasMetric {
    session_id:   string | null;
    category:     string | null;
    intent:       string | null;
    user_query:   string;
    actual_answer:  string;
    expected_answer: string | null;
    retrieval_context: string[];
    [key: string]: unknown;
}

interface ScanEntry {
    label:     string;
    value:     string;
    timestamp: number;
}

interface RagasData {
    metrics:  RagasMetric[];
    allScans: ScanEntry[];
}

// ── Утилиты ───────────────────────────────────────────────────────────────────

function avg(values: (number | null | undefined)[]): number | null {
    // Guard against undefined (missing JSON key) and NaN — both slip through
    // null-checks and produce "NaN%" in KPI cards.
    const valid = values.filter(
        (v): v is number => v !== null && v !== undefined && typeof v === "number" && !Number.isNaN(v)
    );
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function pct(v: number | null | undefined): string {
    if (v === null || v === undefined || Number.isNaN(v)) return "—";
    return (v * 100).toFixed(1) + "%";
}

function scoreBadge(score: number | null | undefined, label: string) {
    if (score === null || score === undefined) {
        return (
            <Badge variant="outline" className="justify-center border-[#e5e7eb] text-[#8e8e93]">
                {label}: —
            </Badge>
        );
    }
    const pass = score >= PASS_THRESHOLD;
    return (
        <Badge className={"justify-center " + (pass
            ? "bg-[#ecfdf5] text-[#059669]"
            : "bg-[#fef2f2] text-[#dc2626]"
        )}>
            {label}: {(score * 100).toFixed(0)}%
        </Badge>
    );
}

/** Все ключи вида *_score из первой записи, отсортированные: стандартные первыми */
function discoverScoreKeys(metrics: RagasMetric[]): string[] {
    if (!metrics.length) return [];
    const all = new Set<string>();
    for (const m of metrics) {
        for (const k of Object.keys(m)) {
            if (k.endsWith("_score")) all.add(k);
        }
    }
    const standard = STANDARD_ORDER.filter((k) => all.has(k));
    const custom   = [...all].filter((k) => !(STANDARD_ORDER as readonly string[]).includes(k)).sort();
    return [...standard, ...custom];
}

// ── Компонент ─────────────────────────────────────────────────────────────────

export default function EvalRagasTab() {
    const [data, setData]           = useState<RagasData | null>(null);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [selectedScan, setSelectedScan] = useState("latest");
    const [pdfLoading, setPdfLoading] = useState(false);

    const activeScan = selectedScan === "latest"
        ? (data?.allScans?.[0]?.value ?? null)
        : selectedScan;

    const downloadPdf = () => {
        if (!activeScan) return;
        setPdfLoading(true);
        const url = `/api/eval/export-pdf?scan=${encodeURIComponent(activeScan)}`;
        fetch(url)
            .then(async (res) => {
                if (!res.ok) {
                    const json = await res.json().catch(() => ({}));
                    throw new Error(json.error || `HTTP ${res.status}`);
                }
                return res.blob();
            })
            .then((blob) => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${activeScan}_report.pdf`;
                a.click();
                URL.revokeObjectURL(a.href);
            })
            .catch((err) => alert(`PDF export failed: ${err.message}`))
            .finally(() => setPdfLoading(false));
    };

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch("/api/eval/ragas?scanFile=" + selectedScan)
            .then(async (res) => {
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
                return json as RagasData;
            })
            .then((json) => { setData(json); setLoading(false); })
            .catch((err) => { setError(err.message); setLoading(false); });
    }, [selectedScan]);

    const scoreKeys = useMemo(() => discoverScoreKeys(data?.metrics ?? []), [data]);

    const stats = useMemo(() => {
        if (!data?.metrics?.length) return null;
        const m = data.metrics;
        const result: Record<string, number | null> = {};
        for (const key of scoreKeys) {
            result[key] = avg(m.map((r) => r[key] as number | null));
        }
        return { scores: result, total: m.length };
    }, [data, scoreKeys]);

    // ── Loading ──────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[40vh]">
                <div className="flex flex-col items-center gap-3 text-[#8e8e93]">
                    <Activity className="w-10 h-10 animate-spin text-emerald-500" />
                    <span className="text-lg font-medium">Загрузка RAGAS-метрик…</span>
                </div>
            </div>
        );
    }

    // ── Error / empty ────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh]">
                <div className="bg-white border border-[#e5e7eb] p-10 rounded-[32px] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] max-w-xl text-center">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
                        <Rocket className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-extrabold tracking-tight mb-3 text-[#222222]">RAGAS-прогоны не найдены</h2>
                    <p className="text-[#8e8e93] text-base mb-6 leading-relaxed">
                        Запустите пайплайн, чтобы получить первые RAGAS-метрики:
                    </p>
                    <code className="block bg-[#f2f3f5] border border-[#e5e7eb] rounded-xl px-4 py-3 text-sm text-[#45515e] text-left font-mono">
                        .venv/bin/python3 eval/eval_ragas_metrics.py \<br />
                        &nbsp;&nbsp;eval/results/&lt;папка_прогона&gt;/
                    </code>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-10">

            {/* Scan selector + PDF export */}
            {data?.allScans && data.allScans.length > 0 && (
                <div className="flex items-center justify-end gap-3">
                    <button
                        onClick={downloadPdf}
                        disabled={pdfLoading || !activeScan}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e5e7eb] bg-white text-[#222222] text-sm font-medium hover:bg-[#f9fafb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        {pdfLoading ? "Генерация…" : "Export PDF"}
                    </button>
                    <div className="w-80">
                        <Select value={selectedScan} onValueChange={(val) => val && setSelectedScan(val)}>
                            <SelectTrigger className="bg-white border-[#e5e7eb] text-[#222222] h-auto py-2">
                                {(() => {
                                    const lbl = data.allScans.find(s => s.value === activeScan)?.label ?? "Выберите прогон";
                                    const dotIdx = lbl.indexOf("·");
                                    if (dotIdx === -1) return <span className="text-sm">{lbl}</span>;
                                    return (
                                        <div className="text-left min-w-0 overflow-hidden">
                                            <div className="text-sm font-medium leading-tight">{lbl.slice(0, dotIdx).trim()}</div>
                                            <div className="text-xs text-[#8e8e93] truncate leading-tight">{lbl.slice(dotIdx + 1).trim()}</div>
                                        </div>
                                    );
                                })()}
                            </SelectTrigger>
                            <SelectContent className="bg-white border-[#e5e7eb] text-[#222222]">
                                {data.allScans.map((scan) => {
                                    const dotIdx = scan.label.indexOf("·");
                                    if (dotIdx === -1) return <SelectItem key={scan.value} value={scan.value}>{scan.label}</SelectItem>;
                                    return (
                                        <SelectItem key={scan.value} value={scan.value}>
                                            <div>
                                                <div className="text-sm font-medium">{scan.label.slice(0, dotIdx).trim()}</div>
                                                <div className="text-xs text-[#8e8e93]">{scan.label.slice(dotIdx + 1).trim()}</div>
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {/* KPI cards — standard + custom, auto-discovered */}
            {stats && scoreKeys.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6">
                    {scoreKeys.map((key) => {
                        const meta  = getMetaForKey(key);
                        const value = stats.scores[key] ?? null;
                        const Icon  = meta.icon;
                        return (
                            <Card
                                key={key}
                                className="bg-white border border-[#e5e7eb] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] rounded-2xl overflow-hidden relative group"
                            >
                                <div className={`absolute inset-0 bg-${meta.color}-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                                <CardHeader className="flex flex-row items-center justify-between pb-1">
                                    <CardTitle className="text-base font-semibold text-[#222222]">{meta.label}</CardTitle>
                                    <Icon className={`h-6 w-6 text-${meta.color}-400 drop-shadow-md shrink-0`} />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-5xl font-bold text-[#222222] tracking-tight drop-shadow-md">{pct(value)}</div>
                                    <p className="text-[12px] text-[#8e8e93] mt-2 leading-snug">{meta.description}</p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Detailed accordion */}
            <div className="space-y-4 pt-4">
                <h2 className="text-2xl font-bold text-[#222222] flex items-center gap-3 drop-shadow-sm mb-6">
                    <FileText className="w-6 h-6 text-emerald-400" /> Детальные результаты RAGAS
                </h2>

                <Accordion type="multiple" className="w-full space-y-4">
                    {data?.metrics.map((m, idx) => {
                        const coreScores = [
                            m.faithfulness_score,
                            m.context_precision_score,
                            m.context_recall_score,
                        ].filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
                        const hasFail = coreScores.some(s => s < PASS_THRESHOLD);

                        return (
                            <AccordionItem
                                key={idx}
                                value={`ragas-${idx}`}
                                className={
                                    "border transition-all duration-300 shadow-sm hover:shadow-md " +
                                    (hasFail ? "border-red-200 bg-red-50" : "border-[#e5e7eb] bg-white") +
                                    " rounded-2xl px-6"
                                }
                            >
                                <AccordionTrigger className="hover:no-underline py-6 px-2 text-[#222222] hover:text-[#45515e] transition-colors">
                                    <div className="flex items-center justify-between w-full pr-4 text-left">
                                        <div className="space-y-2">
                                            <p className="font-bold text-lg text-[#222222] leading-tight">{m.user_query}</p>
                                            <div className="flex gap-2 flex-wrap">
                                                {m.category && (
                                                    <Badge variant="outline" className="bg-[#f2f3f5] text-[#45515e] border-[#e5e7eb] text-sm">
                                                        {m.category}
                                                    </Badge>
                                                )}
                                                {m.session_id && (
                                                    <Badge variant="outline" className="bg-[#f2f3f5] text-[#45515e] border-[#e5e7eb] text-sm font-mono">
                                                        {m.session_id}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        {/* Score badges — standard 5 only in trigger to save space */}
                                        <div className="flex flex-wrap gap-2 justify-end max-w-[280px]">
                                            {scoreBadge(m.faithfulness_score      as number | null, "FA")}
                                            {scoreBadge(m.context_precision_score as number | null, "CP")}
                                            {scoreBadge(m.context_recall_score    as number | null, "CR")}
                                            {scoreBadge(m.answer_correctness_score as number | null, "AC")}
                                            {scoreBadge(m.answer_relevancy_score  as number | null, "AR")}
                                        </div>
                                    </div>
                                </AccordionTrigger>

                                <AccordionContent className="pt-2 pb-6 space-y-6">
                                    {/* Answer vs Expected */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-medium text-[#8e8e93]">Ответ модели</h4>
                                            <div className="bg-[#f2f3f5] p-4 rounded-md text-[#45515e] text-sm border border-[#e5e7eb]">
                                                {m.actual_answer}
                                            </div>
                                        </div>
                                        {m.expected_answer && (
                                            <div className="space-y-2">
                                                <h4 className="text-sm font-medium text-[#8e8e93]">Ожидаемый ответ</h4>
                                                <div className="bg-[#f2f3f5] p-4 rounded-md text-[#45515e] text-sm border border-[#e5e7eb]">
                                                    {m.expected_answer}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Score bars — all discovered metrics incl. custom */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-[#e5e7eb]">
                                        {scoreKeys.map((key) => {
                                            const meta = getMetaForKey(key);
                                            const val  = m[key] as number | null | undefined;
                                            const num  = (val !== null && val !== undefined && !Number.isNaN(val)) ? val : null;
                                            return (
                                                <div key={key} className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl p-3 text-center">
                                                    <div className="text-xs text-[#8e8e93] mb-1">{meta.label}</div>
                                                    <div
                                                        className="text-2xl font-bold"
                                                        style={{ color: num !== null ? meta.hexColor : "#8e8e93" }}
                                                    >
                                                        {num !== null ? (num * 100).toFixed(0) + "%" : "—"}
                                                    </div>
                                                    <div className="text-[10px] text-[#8e8e93] mt-1 leading-snug line-clamp-2">
                                                        {meta.description}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Context chunks */}
                                    {(m.retrieval_context as string[])?.length > 0 && (
                                        <div className="space-y-2 pt-4">
                                            <h4 className="text-base font-semibold text-[#222222]">
                                                Retrieval Context ({(m.retrieval_context as string[]).length} чанков)
                                            </h4>
                                            <div className="space-y-3">
                                                {(m.retrieval_context as string[]).map((ctx, cIdx) => (
                                                    <div
                                                        key={cIdx}
                                                        className="bg-[#f2f3f5] border border-[#e5e7eb] p-4 rounded-xl text-[15px] font-medium text-[#222222] font-mono shadow-inner"
                                                    >
                                                        <span className="text-emerald-500 font-bold mr-2">[{cIdx + 1}]</span>
                                                        {ctx.length > 350 ? ctx.substring(0, 350) + "…" : ctx}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            </div>

            {/* Provider comparison — lazy loaded on expand */}
            <ProviderComparisonSection />

        </div>
    );
}
