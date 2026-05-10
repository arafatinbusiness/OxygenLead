'use client';

import { useState, useEffect, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

export type ScrapingStatus = 'idle' | 'queued' | 'scraping' | 'enriching' | 'scoring' | 'complete' | 'error';

interface ScrapingProgressProps {
  storeId: string;
  token: string;
  initialStatus?: ScrapingStatus;
  initialProgress?: number;
  initialStatusText?: string;
  /** How often to poll in ms (default: 2000) */
  pollInterval?: number;
  /** Whether to show compact version (for grid cards) */
  compact?: boolean;
  /** Callback when scraping completes */
  onComplete?: () => void;
}

export function ScrapingProgressBar({
  storeId,
  token,
  initialStatus = 'idle',
  initialProgress = 0,
  initialStatusText = '',
  pollInterval = 2000,
  compact = false,
  onComplete,
}: ScrapingProgressProps) {
  const [status, setStatus] = useState<ScrapingStatus>(initialStatus);
  const [progress, setProgress] = useState(initialProgress);
  const [statusText, setStatusText] = useState(initialStatusText);

  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/stores/${storeId}/progress`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStatus(data.scrapingStatus || 'idle');
        setProgress(data.scrapingProgress || 0);
        setStatusText(data.scrapingStatusText || '');

        // If complete or error, stop polling
        if (data.scrapingStatus === 'complete' || data.scrapingStatus === 'error') {
          if (data.scrapingStatus === 'complete' && onComplete) {
            onComplete();
          }
          return true; // Signal to stop polling
        }
      }
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
    return false;
  }, [storeId, token, onComplete]);

  // Poll for progress updates
  useEffect(() => {
    // Don't poll if already in a terminal state
    if (status === 'complete' || status === 'error' || status === 'idle') {
      return;
    }

    const interval = setInterval(async () => {
      const shouldStop = await fetchProgress();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [status, pollInterval, fetchProgress]);

  // If idle and no progress, don't show anything
  if (status === 'idle' && progress === 0) {
    return null;
  }

  // If complete, show a brief success indicator
  if (status === 'complete') {
    if (compact) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-green-500">
          <CheckCircle2 className="w-3 h-3" />
          <span>Complete</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-green-500">
        <CheckCircle2 className="w-4 h-4" />
        <span>Scraping complete</span>
      </div>
    );
  }

  // If error, show error state
  if (status === 'error') {
    if (compact) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <XCircle className="w-3 h-3" />
          <span className="truncate">{statusText || 'Error'}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <XCircle className="w-4 h-4" />
        <span>{statusText || 'Scraping failed'}</span>
      </div>
    );
  }

  // Compact version for grid cards
  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            {status === 'queued' ? (
              <Clock className="w-3 h-3" />
            ) : (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
            <span className="truncate max-w-[120px]">{statusText || status}</span>
          </div>
          <span className="text-muted-foreground font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
    );
  }

  // Full version for detail view
  return (
    <div className="space-y-3 p-4 rounded-lg border border-secondary/20 bg-secondary/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {status === 'queued' ? (
            <Clock className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          )}
          <span className="font-medium text-foreground">
            {statusText || status}
          </span>
        </div>
        <span className="text-sm font-bold text-primary">{progress}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Status: {status}</span>
        <span>{progress < 100 ? 'Processing...' : 'Finalizing'}</span>
      </div>
    </div>
  );
}
