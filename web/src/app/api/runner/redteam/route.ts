import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Обязательные параметры
        if (!body.api_contract) {
            return NextResponse.json({ error: "Missing api_contract" }, { status: 400 });
        }

        const projectRoot = path.resolve(process.cwd(), '..');

        const tmpConfigName = `.tmp_redteam_api_config_${randomUUID()}.json`;
        const tmpConfigPath = path.join(projectRoot, tmpConfigName);

        await fs.writeFile(tmpConfigPath, JSON.stringify(body.api_contract, null, 2), 'utf-8');

        const pythonExecutable = path.join(projectRoot, '.venv', 'bin', 'python');
        const scriptPath = path.join(projectRoot, 'scripts', 'run_redteam.py');

        const args = [
            scriptPath,
            '--dynamic-api-config', tmpConfigPath
        ];

        if (body.judge) {
            args.push('--judge', body.judge);
        }

        // Поддержка attacks_per_vulnerability и threshold
        let tmpAttackConfig: string | null = null;
        if (body.attacks_per_vulnerability !== undefined || body.threshold !== undefined) {
            tmpAttackConfig = path.join(projectRoot, `.tmp_redteam_attack_config_${randomUUID()}.yaml`);
            const attackConfigContent = `attacks_per_vulnerability_type: ${body.attacks_per_vulnerability || 1}\nasr_threshold: ${body.threshold || 0.2}\n`;
            await fs.writeFile(tmpAttackConfig, attackConfigContent, 'utf-8');
            args.push('--config', tmpAttackConfig);
        }

        console.log(`>>> Starting RED TEAM dynamic pipeline: ${pythonExecutable} ${args.join(' ')}`);

        const p = spawn(pythonExecutable, args, { cwd: projectRoot });

        p.on('exit', async (code) => {
            console.log(`>>> RED TEAM Pipeline exited with code ${code}`);
            try {
                await fs.unlink(tmpConfigPath);
            } catch (e) {
                console.error("Failed to delete temp config", e);
            }
            if (tmpAttackConfig) {
                try {
                    await fs.unlink(tmpAttackConfig);
                } catch (e) {
                    console.error("Failed to delete temp attack config", e);
                }
            }
        });

        p.stdout.on('data', (d) => process.stdout.write(d.toString()));
        p.stderr.on('data', (d) => process.stderr.write(d.toString()));

        return NextResponse.json({
            success: true,
            message: "Red Teaming Pipeline successfully spawned",
            job_id: tmpConfigName,
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
    }
}
