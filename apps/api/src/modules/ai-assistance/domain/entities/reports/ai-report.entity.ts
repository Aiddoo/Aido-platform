import type { SupportedLocale } from "#api/shared/domain/locale";

import type {
  CategoryBreakdownItem,
  DayPatternItem,
  ReportStats,
  ReportType,
  TimePatternItem,
} from "../../types/reports/ai-report.types.js";

export interface AiReportProps {
  readonly id: number;
  readonly userId: string;
  readonly type: ReportType;
  readonly year: number;
  readonly period: number;
  readonly stats: ReportStats;
  readonly categoryBreakdown: readonly CategoryBreakdownItem[];
  readonly dayPatterns: readonly DayPatternItem[];
  readonly timePatterns: readonly TimePatternItem[];
  readonly aiSummary: string;
  readonly aiTips: readonly string[];
  readonly locale: SupportedLocale;
  readonly hasActivity: boolean;
  readonly generatedAt: Date;
}

/** 저장된 분석 결과. 상태 전이나 HTTP 직렬화를 소유하지 않는다. */
export class AiReport {
  readonly #props: AiReportProps;

  private constructor(props: AiReportProps) {
    this.#props = AiReport.#copy(props);
  }

  static reconstitute(props: AiReportProps): AiReport {
    return new AiReport(props);
  }

  get id(): number {
    return this.#props.id;
  }
  get type(): ReportType {
    return this.#props.type;
  }
  get stats(): ReportStats {
    return { ...this.#props.stats };
  }
  get aiTips(): readonly string[] {
    return [...this.#props.aiTips];
  }
  get snapshot(): AiReportProps {
    return AiReport.#copy(this.#props);
  }

  static #copy(props: AiReportProps): AiReportProps {
    return {
      ...props,
      stats: { ...props.stats },
      categoryBreakdown: props.categoryBreakdown.map((item) => ({ ...item })),
      dayPatterns: props.dayPatterns.map((item) => ({ ...item })),
      timePatterns: props.timePatterns.map((item) => ({ ...item })),
      aiTips: [...props.aiTips],
      generatedAt: new Date(props.generatedAt),
    };
  }
}
