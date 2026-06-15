import { useState, useEffect, useRef } from 'react';
import { pipelineApi } from '../lib/services';

const POLL_INTERVAL_MS = 3000;
const TERMINAL_STATUSES = ['completed', 'failed', 'done', 'error'];

/**
 * Polls the pipeline status for a given documentId and returns the current stage.
 * Stops polling when a terminal status is detected or when documentId becomes undefined.
 */
export function usePipelineStage(documentId?: string): {
  currentStage: string | undefined;
  isTerminal: boolean;
} {
  const [currentStage, setCurrentStage] = useState<string | undefined>(undefined);
  const [isTerminal, setIsTerminal] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!documentId) {
      setCurrentStage(undefined);
      setIsTerminal(false);
      return;
    }

    const poll = async () => {
      try {
        const status = await pipelineApi.status(documentId);
        const stage = status?.manifest?.currentStage as string | undefined;
        if (stage) setCurrentStage(stage);

        const docStatus = status?.status as string | undefined;
        if (docStatus && TERMINAL_STATUSES.includes(docStatus.toLowerCase())) {
          setIsTerminal(true);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // Ignore poll errors silently
      }
    };

    void poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [documentId]);

  return { currentStage, isTerminal };
}
