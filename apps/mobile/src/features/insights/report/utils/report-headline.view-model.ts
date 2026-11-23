import { type AiReport, ReportPolicy } from '../domains/report.model';

export type ReportHeadline =
  | { kind: 'noActivity' }
  | { kind: 'firstReport'; completionRate: number }
  | { kind: 'improved'; completionRate: number; changePoints: number }
  | { kind: 'declined'; completionRate: number; changePoints: number }
  | { kind: 'unchanged'; completionRate: number };

export function getReportHeadline(report: AiReport): ReportHeadline {
  if (!report.hasActivity) {
    return { kind: 'noActivity' };
  }
  const change = ReportPolicy.findCompletionRateChange(report);
  const { completionRate } = report.stats;
  if (change == null) {
    return { kind: 'firstReport', completionRate };
  }
  if (0 < change) {
    return { kind: 'improved', completionRate, changePoints: change };
  }
  if (change < 0) {
    return { kind: 'declined', completionRate, changePoints: Math.abs(change) };
  }
  return { kind: 'unchanged', completionRate };
}
