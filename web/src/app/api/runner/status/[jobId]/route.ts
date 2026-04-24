import { NextResponse } from 'next/server';

const FASTAPI_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Проксируем запрос к FastAPI
    const response = await fetch(`${FASTAPI_URL}/api/jobs/${jobId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Важно для поллинга
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch job status' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
