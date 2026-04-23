import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

/**
 * Parse folder name like: 20260402_121902_20260329_173829_exp_top_k_10
 * Returns human label: "02.04.2026 12:19  ·  exp_top_k_10"
 */
function parseScanLabel(name: string): string {
    // Pattern: YYYYMMDD_HHMMSS_<rest>
    const m = name.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})\d{2}_(.+)$/);
    if (m) {
        const [, y, mo, d, hh, mm, rest] = m;
        // rest might be: 20260329_173829_exp_top_k_10 — drop ALL leading date prefixes
        const expName = rest.replace(/^(\d{8}_\d{6}_)+/, '');
        return `${d}.${mo}.${y} ${hh}:${mm}  ·  ${expName}`;
    }
    // root-level json files
    const mj = name.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})\d{2}_(.+?)_metrics\.json$/);
    if (mj) {
        const [, y, mo, d, hh, mm, rest] = mj;
        const expName = rest.replace(/^(\d{8}_\d{6}_)+/, '');
        return `${d}.${mo}.${y} ${hh}:${mm}  ·  ${expName}`;
    }
    return name;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const scanFile = searchParams.get('scanFile');

    let projectRoot = process.cwd();
    let evalResultsDir = path.join(projectRoot, 'eval', 'results');

    if (!fs.existsSync(evalResultsDir)) {
        projectRoot = path.join(process.cwd(), '..');
        evalResultsDir = path.join(projectRoot, 'eval', 'results');
    }

    if (!fs.existsSync(evalResultsDir)) {
        return NextResponse.json({ error: "Папка eval/results не найдена по пути " + evalResultsDir, metrics: [], allScans: [] }, { status: 404 });
    }

    let scans: {label: string, value: string, timestamp: number}[] = [];

    const entries = fs.readdirSync(evalResultsDir, { withFileTypes: true });

    entries.filter(e => e.isFile() && e.name.endsWith('metrics.json')).forEach(e => {
        scans.push({
            label: parseScanLabel(e.name),
            value: e.name,
            timestamp: fs.statSync(path.join(evalResultsDir, e.name)).mtimeMs
        });
    });

    entries.filter(e => e.isDirectory() && !e.name.endsWith('_ragas')).forEach(d => {
        const metricPath = path.join(evalResultsDir, d.name, 'metrics.json');
        if (fs.existsSync(metricPath)) {
            const label = parseScanLabel(d.name);
            scans.push({
                label: label,
                value: d.name,
                timestamp: fs.statSync(metricPath).mtimeMs
            });
        }
    });

    scans.sort((a, b) => b.timestamp - a.timestamp);

    let selectedValue = scanFile && scanFile !== 'latest' ? scanFile : (scans[0]?.value || null);

    if (!selectedValue) {
        return NextResponse.json({ error: "Нет логов качества (RAG)", metrics: [], allScans: [] }, { status: 404 });
    }

    let targetPath = "";
    if (selectedValue.endsWith('.json')) {
        targetPath = path.join(evalResultsDir, selectedValue);
    } else {
        targetPath = path.join(evalResultsDir, selectedValue, 'metrics.json');
    }

    if (!fs.existsSync(targetPath)) {
        return NextResponse.json({ error: "Файл не найден " + targetPath, metrics: [], allScans: scans }, { status: 404 });
    }

    try {
        const fileContent = fs.readFileSync(targetPath, 'utf-8');
        const metricsData = JSON.parse(fileContent);
        return NextResponse.json({ metrics: metricsData, allScans: scans });
    } catch (e: any) {
        return NextResponse.json({ error: "Ошибка чтения JSON: " + e.message, metrics: [], allScans: scans }, { status: 500 });
    }
}
