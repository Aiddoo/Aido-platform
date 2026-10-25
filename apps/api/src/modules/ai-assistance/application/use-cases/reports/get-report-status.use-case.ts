import type { ReportStatus } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import dayjs from "dayjs";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { now } from "#api/shared/domain/date/utils/core";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { UserLocalePreferenceReaderPort } from "../../ports/parsing/user-locale-preference.reader.port.js";
import { type AiReportRepositoryPort } from "../../ports/reports/ai-report.repository.port.js";
import { toAiReportView } from "../../read-models/reports/ai-report.read-model.js";

/** 사용자 로컬 기준으로 새 리포트를 확인할 수 있다고 안내하는 시각 (디스패치 창 이후) */
const REPORT_READY_TIME = "08:00";

/**
 * 리포트 상태 조회 use-case.
 *
 * 다음 주간/월간 리포트 예정일과 최신 리포트를 반환한다.
 * 리포트는 사용자 로컬 기준 월요일·1일 새벽에 생성되므로 예정 시각도 사용자 시간대로 계산한다.
 */
interface GetReportStatusDependencies {
  readonly aiReportRepository: Pick<AiReportRepositoryPort, "findLatest">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "hasPremiumAccess">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
}

export class GetReportStatus {
  readonly #dependencies: GetReportStatusDependencies;

  constructor(dependencies: GetReportStatusDependencies) {
    this.#dependencies = dependencies;
  }

  /** timezone은 X-Timezone 헤더이며, 없으면 디스패치와 같은 저장 시간대를 쓴다. */
  async execute(userId: string, timezone: string | undefined): Promise<ReportStatus> {
    const hasPremium = await this.#dependencies.entitlementReader.hasPremiumAccess(userId);
    if (!hasPremium) {
      throw new ApplicationException(ErrorCode.AI_1308);
    }

    const zone =
      timezone ?? (await this.#dependencies.localePreferenceReader.read(userId)).timezone;
    const at = now();
    // 달력 날짜를 먼저 정하고 각 경계를 다시 시간대에 적용해 DST offset을 반영한다.
    const localToday = dayjs.utc(dayjs(at).tz(zone).format("YYYY-MM-DD"));
    const readyAt = (date: dayjs.Dayjs) =>
      parseLocalDateTime(date.format("YYYY-MM-DD"), REPORT_READY_TIME, zone);

    const thisMonday = localToday.startOf("isoWeek");
    const nextWeeklyDate = at < readyAt(thisMonday) ? thisMonday : thisMonday.add(1, "week");
    const thisFirst = localToday.startOf("month");
    const nextMonthlyDate = at < readyAt(thisFirst) ? thisFirst : thisFirst.add(1, "month");

    const [latestWeekly, latestMonthly] = await Promise.all([
      this.#dependencies.aiReportRepository.findLatest(userId, "WEEKLY"),
      this.#dependencies.aiReportRepository.findLatest(userId, "MONTHLY"),
    ]);

    return {
      nextWeeklyAt: readyAt(nextWeeklyDate).toISOString(),
      nextMonthlyAt: readyAt(nextMonthlyDate).toISOString(),
      daysUntilWeekly: nextWeeklyDate.diff(localToday, "day"),
      daysUntilMonthly: nextMonthlyDate.diff(localToday, "day"),
      latestWeekly: latestWeekly === null ? null : toAiReportView(latestWeekly),
      latestMonthly: latestMonthly === null ? null : toAiReportView(latestMonthly),
    };
  }
}
