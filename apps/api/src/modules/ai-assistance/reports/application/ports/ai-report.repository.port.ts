import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AiReportId } from "../../domain/ai-report-id.vo.js";
import type { AiReport } from "../../domain/ai-report.aggregate.js";
import type { ReportType } from "../../domain/ai-report.constants.js";

/** 사용자 하나의 리포트 저장소. 같은 주기 리포트가 이미 있으면 save가 duplicateAiReport를 던진다. */
export abstract class AiReportRepositoryPort {
  abstract nextId(): Promise<AiReportId>;
  abstract save(report: AiReport): Promise<void>;
  abstract findByIdAndUserId(reportId: AiReportId, userId: UserId): Promise<AiReport | null>;
  /** 분석 시각이 가장 늦은 리포트 */
  abstract findLatest(userId: UserId, type: ReportType): Promise<AiReport | null>;
  /** 분석 시각 내림차순. type이 null이면 두 종류를 함께 준다 */
  abstract listByUserId(params: {
    readonly userId: UserId;
    readonly type: ReportType | null;
    readonly limit: number;
  }): Promise<AiReport[]>;
  abstract existsForPeriod(params: {
    readonly userId: UserId;
    readonly type: ReportType;
    readonly year: number;
    readonly period: number;
  }): Promise<boolean>;
}
