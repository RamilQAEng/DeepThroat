import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const SCORE_KEYS = [
  "answer_relevancy_score",
  "faithfulness_score",
  "contextual_precision_score",
  "contextual_recall_score",
] as const;

type ScoreKey = (typeof SCORE_KEYS)[number];

interface MetricRow {
  id?: string;
  user_query?: string;
  category?: string;
  intent?: string;
  [key: string]: unknown;
}

interface ScanSummary {
  scan: string;
  avg: Record<ScoreKey, number | null>;
  passed: number;
  total: number;
}

interface RowDiff {
  id: string;
  query: string;
  category: string | null;
  scores_a: Record<ScoreKey, number | null>;
  scores_b: Record<ScoreKey, number | null>;
  delta: Record<ScoreKey, number | null>;
}

function resolveMetricsPath(evalResultsDir: string, scan: string): string | null {
  if (scan.endsWith(".json")) {
    const p = path.join(evalResultsDir, scan);
    return fs.existsSync(p) ? p : null;
  }
  const p = path.join(evalResultsDir, scan, "metrics.json");
  return fs.existsSync(p) ? p : null;
}

function loadMetrics(filePath: string): MetricRow[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as MetricRow[];
}

function buildSummary(scan: string, rows: MetricRow[]): ScanSummary {
  const avg: Record<ScoreKey, number | null> = {} as Record<ScoreKey, number | null>;

  for (const key of SCORE_KEYS) {
    const vals = rows
      .map((r) => r[key])
      .filter((v): v is number => v !== null && v !== undefined && typeof v === "number");
    avg[key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  let passed = 0;
  rows.forEach((r) => {
    const arOk = r.answer_relevancy_passed === true;
    const faOk = r.faithfulness_passed === null || r.faithfulness_passed === true;
    if (arOk && faOk) passed++;
  });

  return { scan, avg, passed, total: rows.length };
}

function buildRowDiffs(rowsA: MetricRow[], rowsB: MetricRow[]): RowDiff[] {
  const hasIds = rowsA.some((r) => r.id) || rowsB.some((r) => r.id);

  if (hasIds) {
    const mapB = new Map<string, MetricRow>();
    rowsB.forEach((r) => {
      if (r.id) mapB.set(String(r.id), r);
    });

    const allIds = new Map<string, MetricRow>();
    rowsA.forEach((r) => { if (r.id) allIds.set(String(r.id), r); });
    rowsB.forEach((r) => { if (r.id) allIds.set(String(r.id), r); });

    const diffs: RowDiff[] = [];
    allIds.forEach((_, id) => {
      const a = rowsA.find((r) => String(r.id) === id) ?? null;
      const b = mapB.get(id) ?? null;
      const base = a ?? b!;

      const scores_a: Record<ScoreKey, number | null> = {} as Record<ScoreKey, number | null>;
      const scores_b: Record<ScoreKey, number | null> = {} as Record<ScoreKey, number | null>;
      const delta: Record<ScoreKey, number | null> = {} as Record<ScoreKey, number | null>;

      for (const key of SCORE_KEYS) {
        const va = (a?.[key] as number | null | undefined) ?? null;
        const vb = (b?.[key] as number | null | undefined) ?? null;
        scores_a[key] = va;
        scores_b[key] = vb;
        delta[key] = va !== null && vb !== null ? vb - va : null;
      }

      diffs.push({
        id,
        query: String(base?.user_query ?? ""),
        category: (base?.category as string) ?? null,
        scores_a,
        scores_b,
        delta,
      });
    });
    return diffs;
  }

  // Fallback: no ids — match by index
  const len = Math.max(rowsA.length, rowsB.length);
  const diffs: RowDiff[] = [];
  for (let i = 0; i < len; i++) {
    const a = rowsA[i] ?? null;
    const b = rowsB[i] ?? null;
    const base = a ?? b!;

    const scores_a: Record<ScoreKey, number | null> = {} as Record<ScoreKey, number | null>;
    const scores_b: Record<ScoreKey, number | null> = {} as Record<ScoreKey, number | null>;
    const delta: Record<ScoreKey, number | null> = {} as Record<ScoreKey, number | null>;

    for (const key of SCORE_KEYS) {
      const va = (a?.[key] as number | null | undefined) ?? null;
      const vb = (b?.[key] as number | null | undefined) ?? null;
      scores_a[key] = va;
      scores_b[key] = vb;
      delta[key] = va !== null && vb !== null ? vb - va : null;
    }

    diffs.push({
      id: String(base?.id ?? `Q-${i + 1}`),
      query: String(base?.user_query ?? ""),
      category: (base?.category as string) ?? null,
      scores_a,
      scores_b,
      delta,
    });
  }
  return diffs;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scan1 = searchParams.get("scan1");
  const scan2 = searchParams.get("scan2");

  if (!scan1 || !scan2) {
    return NextResponse.json(
      { error: "Параметры scan1 и scan2 обязательны" },
      { status: 400 }
    );
  }

  let projectRoot = process.cwd();
  let evalResultsDir = path.join(projectRoot, "eval", "results");
  if (!fs.existsSync(evalResultsDir)) {
    projectRoot = path.join(process.cwd(), "..");
    evalResultsDir = path.join(projectRoot, "eval", "results");
  }

  const path1 = resolveMetricsPath(evalResultsDir, scan1);
  const path2 = resolveMetricsPath(evalResultsDir, scan2);

  if (!path1) {
    return NextResponse.json({ error: `Скан не найден: ${scan1}` }, { status: 404 });
  }
  if (!path2) {
    return NextResponse.json({ error: `Скан не найден: ${scan2}` }, { status: 404 });
  }

  try {
    const rowsA = loadMetrics(path1);
    const rowsB = loadMetrics(path2);

    const summaryA = buildSummary(scan1, rowsA);
    const summaryB = buildSummary(scan2, rowsB);

    // summary-level delta
    const summaryDelta: Record<ScoreKey, number | null> = {} as Record<ScoreKey, number | null>;
    for (const key of SCORE_KEYS) {
      const a = summaryA.avg[key];
      const b = summaryB.avg[key];
      summaryDelta[key] = a !== null && b !== null ? b - a : null;
    }

    const rows = buildRowDiffs(rowsA, rowsB);

    return NextResponse.json({
      summary_a: summaryA,
      summary_b: summaryB,
      summary_delta: summaryDelta,
      rows,
      score_keys: SCORE_KEYS,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Ошибка обработки: " + msg }, { status: 500 });
  }
}
