import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

/**
 * GET /api/eval/providers
 *
 * Scans eval/results/ for dirs that contain meta.json (provider-tagged runs).
 * Groups by judge_name and returns per-judge metric averages for comparison.
 *
 * Response:
 * {
 *   judges: [
 *     {
 *       name: "gpt4o-mini-or",
 *       model: "openai/gpt-4o-mini",
 *       provider: "openrouter",
 *       runs: [ { dir, timestamp, total_records, metrics: { faithfulness_score: 0.82, ... } } ]
 *       avg: { faithfulness_score: 0.82, ... }   // mean across all runs
 *     }
 *   ],
 *   score_keys: ["faithfulness_score", ...]
 * }
 */

const SCORE_KEYS = [
    'faithfulness_score',
    'answer_relevancy_score',
    'context_precision_score',
    'context_recall_score',
    'answer_correctness_score',
] as const;

type ScoreKey = typeof SCORE_KEYS[number];

interface RunEntry {
    dir: string;
    timestamp: string;
    total_records: number;
    metrics: Partial<Record<ScoreKey, number>>;
}

interface JudgeEntry {
    name: string;
    model: string;
    provider: string;
    runs: RunEntry[];
    avg: Partial<Record<ScoreKey, number>>;
}

function resolveResultsDir(projectRoot: string): string {
    const candidate = path.join(projectRoot, 'eval', 'results');
    if (fs.existsSync(candidate)) return candidate;
    return path.join(projectRoot, '..', 'eval', 'results');
}

function computeAvg(runs: RunEntry[]): Partial<Record<ScoreKey, number>> {
    const avg: Partial<Record<ScoreKey, number>> = {};
    for (const key of SCORE_KEYS) {
        const vals = runs.map(r => r.metrics[key]).filter((v): v is number => v != null);
        if (vals.length > 0) avg[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return avg;
}

function loadMetrics(runDir: string): Partial<Record<ScoreKey, number>> {
    const metricsPath = path.join(runDir, 'metrics.json');
    if (!fs.existsSync(metricsPath)) return {};
    try {
        const rows: Record<string, unknown>[] = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
        const result: Partial<Record<ScoreKey, number>> = {};
        for (const key of SCORE_KEYS) {
            const vals = rows
                .map(r => r[key])
                .filter((v): v is number => typeof v === 'number' && !isNaN(v));
            if (vals.length > 0) result[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
        return result;
    } catch {
        return {};
    }
}

export async function GET(): Promise<Response> {
    const projectRoot = process.cwd();
    const resultsDir = resolveResultsDir(projectRoot);

    if (!fs.existsSync(resultsDir)) {
        return NextResponse.json({ judges: [], score_keys: SCORE_KEYS });
    }

    const entries = fs.readdirSync(resultsDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);

    const judgeMap = new Map<string, JudgeEntry>();

    for (const dirName of entries) {
        const dirPath = path.join(resultsDir, dirName);
        const metaPath = path.join(dirPath, 'meta.json');
        if (!fs.existsSync(metaPath)) continue;

        let meta: Record<string, unknown>;
        try {
            meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        } catch {
            continue;
        }

        const judgeName = String(meta.judge_name ?? 'unknown');
        const judgeModel = String(meta.judge_model ?? '');
        const judgeProvider = String(meta.provider ?? '');
        const timestamp = String(meta.timestamp ?? '');
        const totalRecords = Number(meta.total_records ?? 0);

        const metrics = loadMetrics(dirPath);

        const run: RunEntry = { dir: dirName, timestamp, total_records: totalRecords, metrics };

        if (!judgeMap.has(judgeName)) {
            judgeMap.set(judgeName, {
                name: judgeName,
                model: judgeModel,
                provider: judgeProvider,
                runs: [],
                avg: {},
            });
        }
        judgeMap.get(judgeName)!.runs.push(run);
    }

    // Sort runs by timestamp desc, compute avg per judge
    const judges: JudgeEntry[] = [];
    for (const entry of judgeMap.values()) {
        entry.runs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        entry.avg = computeAvg(entry.runs);
        judges.push(entry);
    }

    // Detect which score keys actually have data
    const presentKeys = SCORE_KEYS.filter(k =>
        judges.some(j => j.avg[k] != null)
    );

    return NextResponse.json({ judges, score_keys: presentKeys });
}
