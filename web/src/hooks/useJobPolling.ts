import { useEffect, useRef, useState } from 'react';

export interface JobStatus {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  processed: number;
  total: number;
  current_item: string | null;
  results_path: string | null;
  error: string | null;
  created_at: string | null;
  completed_at: string | null;
}

interface UseJobPollingOptions {
  jobId: string | null;
  enabled: boolean;
  interval?: number; // milliseconds
  onComplete?: (status: JobStatus) => void;
  onError?: (error: string) => void;
}

/**
 * Hook для polling статуса фоновой задачи (eval/redteam).
 * Автоматически опрашивает /api/runner/status/{job_id} каждые N секунд.
 */
export function useJobPolling({
  jobId,
  enabled,
  interval = 3000,
  onComplete,
  onError,
}: UseJobPollingOptions) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!jobId || !enabled) {
      setIsPolling(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    setIsPolling(true);

    const poll = async () => {
      try {
        const res = await fetch(`/api/runner/status/${jobId}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data: JobStatus = await res.json();
        setStatus(data);

        // Если задача завершилась — останавливаем polling
        if (data.status === 'completed') {
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onComplete?.(data);
        } else if (data.status === 'failed') {
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onError?.(data.error || 'Job failed');
        }
      } catch (err) {
        console.error('[useJobPolling] Error:', err);
        // Не останавливаем polling при ошибке сети — попробуем еще раз
      }
    };

    // Сразу делаем первый запрос
    poll();

    // Запускаем интервал
    intervalRef.current = setInterval(poll, interval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId, enabled, interval, onComplete, onError]);

  return { status, isPolling };
}
