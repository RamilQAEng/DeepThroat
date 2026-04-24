import { NextResponse } from 'next/server';

const FASTAPI_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Проксируем запрос к FastAPI
    const response = await fetch(`${FASTAPI_URL}/api/jobs/${jobId}/status`);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const status = await response.json();
    return NextResponse.json(status);

  } catch (error: unknown) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
