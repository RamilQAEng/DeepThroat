import { NextResponse } from 'next/server';

const FASTAPI_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[/api/runner/redteam] Received body:', JSON.stringify(body, null, 2));

    // Валидация
    if (!body.target) {
      return NextResponse.json(
        { error: 'Missing required field: target' },
        { status: 400 }
      );
    }

    // Запрос к FastAPI микросервису
    const fastapiPayload = {
      target: body.target,
      num_attacks: body.num_attacks || 10,
      attack_types: body.attack_types || [],
      system_prompt: body.system_prompt || null,
    };

    console.log('[/api/runner/redteam] Sending to FastAPI:', JSON.stringify(fastapiPayload, null, 2));

    const response = await fetch(`${FASTAPI_URL}/api/runner/redteam`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fastapiPayload),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.detail || 'Failed to create redteam job' },
        { status: response.status }
      );
    }

    const { job_id, status } = await response.json();

    return NextResponse.json({
      job_id,
      status,
      message: 'Red Team scanning started.',
    });

  } catch (error: unknown) {
    console.error('Error creating redteam job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
