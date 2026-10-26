import type {
  AggregatedReportData,
  GeneratedReportContent,
  ReportType,
} from "../../../../domain/types/reports/ai-report.types.js";
import type { BuiltPrompt, StructuredOutput } from "../../structured-output.js";

export interface ReportPromptInput {
  readonly data: AggregatedReportData;
  readonly periodLabel: string;
  readonly type: ReportType;
  /** 사용자 로컬 기간 첫날·마지막 날 (YYYY-MM-DD) */
  readonly period: { readonly start: string; readonly end: string };
  readonly prevTips: readonly string[] | null;
}

export interface ReportPromptDefinition {
  readonly promptVersion: string;
  build(input: ReportPromptInput): BuiltPrompt;
  /** context는 build에 넘긴 입력이다. 정규화가 문장 속 숫자를 그 입력의 근거로 검증한다. */
  readonly output: StructuredOutput<GeneratedReportContent, ReportPromptInput>;
}
