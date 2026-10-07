import type { ReportStatus } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import dayjs from "dayjs";

import type { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type AiReportRepositoryPort } from "../../ports/reports/ai-report.repository.port.js";

/** 리포트 생성 기준 타임존 (KST 고정) */
const KST = "Asia/Seoul";
/** 리포트 크론 실행 시각 (KST) */
const REPORT_HOUR = 8;

/**
 * 리포트 상태 조회 use-case.
 *
 * 다음 주간/월간 리포트 예정일과 최신 리포트를 반환한다.
 * 리포트 생성은 KST 08:00 고정이므로 KST 기준으로 계산한다.
 */
interface GetReportStatusDependencies {
  readonly aiReportRepository: AiReportRepositoryPort;
  readonly entitlementService: EntitlementService;
}

export class GetReportStatus {
  readonly #dependencies: GetReportStatusDependencies;

  constructor(dependencies: GetReportStatusDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, _timezone: string): Promise<ReportStatus> {
    const hasPremium = await this.#dependencies.entitlementService.hasPremiumAccess(userId);
    if (!hasPremium) {
      throw new ApplicationException(ErrorCode.AI_1308);
    }

    const kstNow = dayjs(now()).tz(KST);

    // 다음 주간 리포트: 이번 주 또는 다음 주 월요일 08:00 KST
    const thisMonday = kstNow.startOf("isoWeek").hour(REPORT_HOUR);
    const nextWeeklyKst = kstNow.isBefore(thisMonday) ? thisMonday : thisMonday.add(1, "week");

    // 다음 월간 리포트: 이번 달 또는 다음 달 1일 08:00 KST
    const thisFirst = kstNow.startOf("month").hour(REPORT_HOUR);
    const nextMonthlyKst = kstNow.isBefore(thisFirst)
      ? thisFirst
      : kstNow.add(1, "month").startOf("month").hour(REPORT_HOUR);

    const daysUntilWeekly = nextWeeklyKst.startOf("day").diff(kstNow.startOf("day"), "day");
    const daysUntilMonthly = nextMonthlyKst.startOf("day").diff(kstNow.startOf("day"), "day");

    const [latestWeekly, latestMonthly] = await Promise.all([
      this.#dependencies.aiReportRepository.findLatest(userId, "WEEKLY"),
      this.#dependencies.aiReportRepository.findLatest(userId, "MONTHLY"),
    ]);

    return {
      nextWeeklyAt: nextWeeklyKst.utc().toISOString(),
      nextMonthlyAt: nextMonthlyKst.utc().toISOString(),
      daysUntilWeekly,
      daysUntilMonthly,
      latestWeekly: latestWeekly ? latestWeekly.toView() : null,
      latestMonthly: latestMonthly ? latestMonthly.toView() : null,
    };
  }
}
