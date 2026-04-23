import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const scanFile = searchParams.get('scan');
    const fileType = searchParams.get('type'); // 'md' | 'csv'

    if (!scanFile || !fileType) {
        return NextResponse.json({ error: 'Missing scan or type param' }, { status: 400 });
    }

    let projectRoot = process.cwd();
    let evalResultsDir = path.join(projectRoot, 'eval', 'results');
    if (!fs.existsSync(evalResultsDir)) {
        evalResultsDir = path.join(projectRoot, '..', 'eval', 'results');
    }

    const fileName = fileType === 'md' ? 'report.md' : 'metrics.csv';

    // Build candidate paths
    let filePath: string;
    if (scanFile.endsWith('.json')) {
        // Root-level file — strip _metrics.json to find dir
        const base = scanFile.replace('_metrics.json', '');
        // Try dir first, then root-level csv/md
        const dirPath = path.join(evalResultsDir, base, fileName);
        const rootPath = path.join(evalResultsDir, scanFile.replace('metrics.json', fileName.replace('report.', '')));
        filePath = fs.existsSync(dirPath) ? dirPath : rootPath;
    } else {
        filePath = path.join(evalResultsDir, scanFile, fileName);
    }

    // Check if file exists before reading
    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: `File not found: ${filePath}` }, { status: 404 });
    }

    const stats = fs.statSync(filePath);
    // Read as Buffer to prevent encoding issues with large files or special characters
    const content = fs.readFileSync(filePath); 
    const mimeType = fileType === 'md' ? 'text/markdown; charset=utf-8' : 'text/csv; charset=utf-8';
    
    // Clean filename and ensure it's quoted for browser compatibility
    const downloadName = (scanFile + '_' + fileName).replace(/\s+/g, '_');

    return new NextResponse(content, {
        headers: {
            'Content-Type': mimeType,
            'Content-Length': stats.size.toString(),
            'Content-Disposition': `attachment; filename="${downloadName}"`,
            'Cache-Control': 'no-cache',
        },
    });
}
