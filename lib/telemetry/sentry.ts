// Evee - Telemetry & Error Tracking Adapter
// Pluggable Sentry / Logflare / OpenTelemetry integration

export interface ErrorContext {
  userId?: string;
  organizationId?: string;
  component?: string;
  extra?: Record<string, any>;
}

export function captureException(error: unknown, context?: ErrorContext): void {
  const err = error instanceof Error ? error : new Error(String(error));

  const logPayload = {
    timestamp: new Date().toISOString(),
    name: err.name,
    message: err.message,
    stack: err.stack,
    ...context,
  };

  // Structured logging for CloudWatch / Vercel Logs / Datadog
  console.error('[TELEMETRY_ERROR]', JSON.stringify(logPayload));

  // If SENTRY_DSN is configured, dynamically dispatch
  if (process.env.SENTRY_DSN && typeof window !== 'undefined') {
    try {
      (window as any).Sentry?.captureException(err, { extra: context?.extra });
    } catch {}
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
  console.log(`[TELEMETRY_${level.toUpperCase()}]`, JSON.stringify({ message, timestamp: new Date().toISOString(), ...context }));
}
