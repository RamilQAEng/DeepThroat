import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Валидация расширения файла
        const fileName = file.name;
        const ext = path.extname(fileName).toLowerCase();

        if (ext !== '.csv' && ext !== '.jsonl') {
            return NextResponse.json({
                error: "Invalid file format. Only CSV and JSONL files are supported."
            }, { status: 400 });
        }

        // Путь к папке для датасетов
        const projectRoot = path.resolve(process.cwd(), '..');
        const uploadsDir = path.join(projectRoot, 'eval', 'data');

        // Создаём папку, если её нет
        if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true });
        }

        // Генерируем безопасное имя файла (убираем опасные символы)
        const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const filePath = path.join(uploadsDir, safeName);

        // Проверяем, что файл не существует
        if (existsSync(filePath)) {
            return NextResponse.json({
                error: `File "${safeName}" already exists. Please rename or delete the existing file first.`
            }, { status: 409 });
        }

        // Читаем и сохраняем файл
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Валидация содержимого для JSONL
        if (ext === '.jsonl') {
            const content = buffer.toString('utf-8');
            const lines = content.trim().split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue; // пропускаем пустые строки

                try {
                    JSON.parse(line);
                } catch (e) {
                    return NextResponse.json({
                        error: `Invalid JSONL format at line ${i + 1}: ${line.substring(0, 50)}...`
                    }, { status: 400 });
                }
            }
        }

        // Валидация содержимого для CSV (базовая проверка)
        if (ext === '.csv') {
            const content = buffer.toString('utf-8');
            const lines = content.trim().split('\n');

            if (lines.length < 2) {
                return NextResponse.json({
                    error: "CSV file must have at least a header row and one data row."
                }, { status: 400 });
            }
        }

        await writeFile(filePath, buffer);

        // Читаем первые несколько строк для preview
        const content = buffer.toString('utf-8');
        const lines = content.trim().split('\n').slice(0, 5);

        let preview = [];
        if (ext === '.jsonl') {
            preview = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            }).filter(Boolean);
        } else {
            preview = lines;
        }

        return NextResponse.json({
            success: true,
            fileName: safeName,
            filePath: path.join('eval', 'data', safeName),
            size: file.size,
            preview: preview,
            message: `Dataset "${safeName}" uploaded successfully!`
        });

    } catch (e: any) {
        console.error("Upload error:", e);
        return NextResponse.json({
            error: e.message || "Unknown error during upload"
        }, { status: 500 });
    }
}
