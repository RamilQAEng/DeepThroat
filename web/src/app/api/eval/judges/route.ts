import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

/**
 * GET /api/eval/judges
 *
 * Returns list of available judge models from eval/config/targets.yaml
 */
export async function GET() {
  try {
    const projectRoot = path.resolve(process.cwd(), '..');
    const targetsPath = path.join(projectRoot, 'eval', 'config', 'targets.yaml');

    if (!fs.existsSync(targetsPath)) {
      return NextResponse.json({ judges: [] });
    }

    const fileContent = fs.readFileSync(targetsPath, 'utf-8');
    const data = yaml.load(fileContent) as { targets?: Array<{ name: string; model: string; provider: string }> };

    const judges = (data.targets || []).map(t => ({
      name: t.name,
      model: t.model,
      provider: t.provider
    }));

    return NextResponse.json({ judges });

  } catch (error: unknown) {
    console.error('Error loading judges:', error);
    return NextResponse.json({ judges: [] });
  }
}
