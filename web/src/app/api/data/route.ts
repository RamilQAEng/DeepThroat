import { NextResponse } from 'next/server';
import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';
import fs from 'fs';

// @ts-ignore
let db: any = null;
let initPromise: Promise<any> | null = null;

async function getDbConnection() {
  if (db) return await db.connect();
  if (!initPromise) {
    initPromise = DuckDBInstance.create(':memory:').then(async (database: any) => {
      db = database;
      return database;
    });
  }
  const database = await initPromise;
  return await database.connect();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scanFile = searchParams.get('scanFile');

    let projectRoot = process.cwd();
    let resultsDir = path.join(projectRoot, 'results');
    
    if (!fs.existsSync(resultsDir)) {
        projectRoot = path.join(process.cwd(), '..');
        resultsDir = path.join(projectRoot, 'results');
    }
    
    const historyDir = path.join(resultsDir, 'history');
    
    // Check if latest.parquet exists
    const latestPath = path.join(resultsDir, 'latest.parquet');
    if (!fs.existsSync(latestPath)) {
      return NextResponse.json({ error: "No scans found at " + latestPath, latest: null, history: [], allScans: [] }, { status: 404 });
    }

    const connection = await getDbConnection();

    // 1. Get history trend (aggregate of all history parquet files)
    let historyTrend = [];
    if (fs.existsSync(historyDir) && fs.readdirSync(historyDir).filter(f => f.endsWith('.parquet')).length > 0) {
        try {
            const result = await connection.run(`
            SELECT 
                timestamp,
                SUM(CAST(failed AS INT)) AS failed,
                SUM(CAST(total AS INT)) AS total,
                SUM(CAST(failed AS INT)) / SUM(CAST(total AS FLOAT)) AS asr,
                1.0 - (SUM(CAST(failed AS INT)) / SUM(CAST(total AS FLOAT))) AS pass_rate
            FROM read_parquet('${path.join(historyDir, '*.parquet')}')
            GROUP BY timestamp
            ORDER BY timestamp ASC
            `);
            const cols = result.columnNames();
            const rows = await result.getRows();
            historyTrend = rows.map((r: any) => {
                const arr = typeof r.toJSON === 'function' ? r.toJSON() : r;
                const obj: any = {};
                cols.forEach((col: string, i: number) => { obj[col] = arr[i]; });
                return obj;
            });
        } catch (e) {
            console.error("Error reading history parquet:", e);
        }
    }

    // 2. List all available scans for comparison
    const allScans = [];
    allScans.push({ label: '📌 Последний скан', value: 'latest' });
    if (fs.existsSync(historyDir)) {
      const files = fs.readdirSync(historyDir)
        .filter(f => f.endsWith('.parquet'))
        .sort((a,b) => b.localeCompare(a)); // sort descending

      files.forEach(f => {
        // Format: 20260415 103954818039Z.parquet -> "15.04.2026 10:39"
        const filename = f.replace('.parquet', '');
        let formattedLabel = filename;

        try {
          // Try to parse timestamp format: YYYYMMDD HHMMSS...
          const match = filename.match(/^(\d{4})(\d{2})(\d{2})\s+(\d{2})(\d{2})/);
          if (match) {
            const [_, year, month, day, hour, minute] = match;
            formattedLabel = `${day}.${month}.${year} ${hour}:${minute}`;
          } else {
            // Fallback: just replace T with space
            formattedLabel = filename.replace('T', ' ');
          }
        } catch (e) {
          // If parsing fails, use filename as-is
          formattedLabel = filename.replace('T', ' ');
        }

        allScans.push({ label: formattedLabel, value: `history/${f}` });
      });
    }

    // 3. Get the selected scan data
    let targetParquetPath = latestPath;
    if (scanFile && scanFile !== 'latest') {
        const potentialPath = path.join(resultsDir, scanFile);
        if (potentialPath.startsWith(resultsDir) && fs.existsSync(potentialPath)) {
            targetParquetPath = potentialPath;
        }
    }

    // Query scan details
    const result = await connection.run(`SELECT * FROM read_parquet('${targetParquetPath}')`);
    const cols = result.columnNames();
    let scanData = await result.getRows();
    scanData = scanData.map((r: any) => {
        const arr = typeof r.toJSON === 'function' ? r.toJSON() : r;
        const obj: any = {};
        cols.forEach((col: string, i: number) => { obj[col] = arr[i]; });
        return obj;
    });

    // Extract metadata from the first row of scanData
    const metadata = scanData.length > 0 ? {
        model_version: scanData[0].model_version,
        judge_version: scanData[0].judge_version,
        timestamp: scanData[0].timestamp
    } : null;

    const body = {
      scanData,
      metadata,
      historyTrend,
      allScans
    };

    const replacer = (key: string, value: any) =>
      typeof value === 'bigint' ? Number(value) : value;

    return new NextResponse(JSON.stringify(body, replacer), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("API Error:", error);
    const errBody = { error: error.message };
    return new NextResponse(JSON.stringify(errBody), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }
}
