import {
  type ExceptionReportContext,
  ExceptionReporterPort,
} from "#api/shared/application/ports/exception-reporter.port";

export class RecordingExceptionReporter extends ExceptionReporterPort {
  readonly reports: { readonly error: unknown; readonly context: ExceptionReportContext }[] = [];

  report(error: unknown, context: ExceptionReportContext): void {
    this.reports.push({ error, context });
  }
}
