import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { SupportedLocale } from "#api/shared/domain/locale";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { AiReportId } from "./ai-report-id.vo.js";
import type {
  CategoryBreakdownItem,
  DayPatternItem,
  ReportContentSource,
  ReportStats,
  ReportType,
  TimePatternItem,
} from "./ai-report.constants.js";

export interface AiReportPrimitives {
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
  readonly generatedAt: Temporal.Instant;
  /** 옛 행은 출처를 남기지 않아 null이다 */
  readonly contentSource: ReportContentSource | null;
  readonly promptVersion: string | null;
}

type AiReportProps = Omit<AiReportPrimitives, "id" | "userId"> & { readonly userId: UserId };

export type CreateAiReportParams = Omit<AiReportPrimitives, "id" | "userId" | "generatedAt"> & {
  readonly id: AiReportId;
  readonly userId: UserId;
  readonly contentSource: ReportContentSource;
  readonly now: Temporal.Instant;
};

type CopiedFields = Pick<
  AiReportPrimitives,
  "stats" | "categoryBreakdown" | "dayPatterns" | "timePatterns" | "aiTips"
>;

function copyPrimitives<T extends CopiedFields>(primitives: T): T {
  return {
    ...primitives,
    stats: { ...primitives.stats },
    categoryBreakdown: primitives.categoryBreakdown.map((item) => ({ ...item })),
    dayPatterns: primitives.dayPatterns.map((item) => ({ ...item })),
    timePatterns: primitives.timePatterns.map((item) => ({ ...item })),
    aiTips: [...primitives.aiTips],
  };
}

/** 한 주기의 저장된 분석 결과. 만든 뒤 바뀌지 않고 HTTP 표현은 presentation 매퍼가 만든다. */
export class AiReport extends AggregateRoot<AiReportId, AiReportProps> {
  static create(params: CreateAiReportParams): AiReport {
    const { id, userId, now, ...content } = params;
    return new AiReport(id, { ...copyPrimitives(content), userId, generatedAt: now });
  }

  static reconstitute(primitives: AiReportPrimitives): AiReport {
    const { id, userId, ...content } = primitives;
    return new AiReport(AiReportId.reconstitute(id), {
      ...copyPrimitives(content),
      userId: UserId.reconstitute(userId),
    });
  }

  get type(): ReportType {
    return this.props.type;
  }

  get locale(): SupportedLocale {
    return this.props.locale;
  }

  get stats(): ReportStats {
    return { ...this.props.stats };
  }

  get aiTips(): readonly string[] {
    return [...this.props.aiTips];
  }

  toPrimitives(): AiReportPrimitives {
    const { userId, ...content } = this.props;
    return { ...copyPrimitives(content), id: this.id.value, userId: userId.value };
  }
}
