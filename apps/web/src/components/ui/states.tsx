import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';
import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';

/**
 * Shared empty / loading / error states.
 *
 * Empty states are a first-class part of the product: an assessment with no data
 * must say what to do next rather than showing zeros as if they were results.
 */

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({ title, description, icon, action, className }: EmptyStateProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center',
      className,
    )}
  >
    <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
      {icon ?? <Inbox className="size-5" />}
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
    {action}
  </div>
);

export interface ErrorStateProps {
  title?: string;
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

const messageFrom = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong.';
};

export const ErrorState = ({ title = 'Could not load this', error, onRetry, className }: ErrorStateProps) => (
  <div
    role="alert"
    className={cn(
      'flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4',
      className,
    )}
  >
    <div className="flex items-start gap-2">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{messageFrom(error)}</p>
      </div>
    </div>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);

export const LoadingState = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status" aria-live="polite">
    <Loader2 className="size-4 animate-spin" />
    {label}
  </div>
);

export const ListSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2" aria-hidden="true">
    {Array.from({ length: rows }).map((_, index) => (
      <Skeleton key={index} className="h-11 w-full" />
    ))}
  </div>
);

export const CardSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
    {Array.from({ length: count }).map((_, index) => (
      <Skeleton key={index} className="h-24 w-full" />
    ))}
  </div>
);
