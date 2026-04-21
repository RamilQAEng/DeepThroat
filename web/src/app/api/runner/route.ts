import { NextResponse } from 'next/server';

const FASTAPI_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[/api/runner] Received body:', JSON.stringify(body, null, 2));

    // Валидация
    if (!body.dataset || !body.model) {
      console.error('[/api/runner] Validation failed:', { dataset: body.dataset, model: body.model });
      return NextResponse.json(
        { error: 'Missing required fields: dataset, model' },
        { status: 400 }
      );
    }

    // Запрос к FastAPI микросервису
    const fastapiPayload = {
      dataset: body.dataset,
      model: body.model,
      metrics: body.metrics || ['answer_relevancy', 'faithfulness', 'contextual_precision'],
      n_samples: body.n_samples || 50,
      api_contract: body.api_contract || null,
      workers: body.workers || 1,
      thresholds: body.thresholds || null,
    };
    console.log('[/api/runner] Sending to FastAPI:', JSON.stringify(fastapiPayload, null, 2));

    const response = await fetch(`${FASTAPI_URL}/api/runner/eval`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fastapiPayload),
    });

    console.log('[/api/runner] FastAPI response status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error('[/api/runner] FastAPI error:', error);
      return NextResponse.json(
        { error: error.detail || 'Failed to create job' },
        { status: response.status }
      );
    }

    const { job_id, status } = await response.json();

    return NextResponse.json({
      job_id,
      status,
      message: 'Evaluation started. Poll /api/jobs/{job_id}/status for updates.',
    });

  } catch (error: unknown) {
    console.error('Error creating eval job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
