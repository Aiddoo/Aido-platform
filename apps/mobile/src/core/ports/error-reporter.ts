export interface ErrorReporterContext {
  endpoint?: string;
  feature?: string;
  method?: string;
  errorCode?: string;
  statusCode?: number;
}

export interface ErrorReporter {
  captureException(error: Error, context?: ErrorReporterContext): void;
  captureMessage(message: string, context?: ErrorReporterContext): void;
  setUserId(userId: string | null): void;
}
