import dayjs from "dayjs";

import {
  assertEntitled,
  type EntitlementReaderPort,
} from "#api/modules/access/entitlements/access-entitlements.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import type { UserLocalePreferenceReaderPort } from "../../../generation/application/ports/user-locale-preference.reader.port.js";
import { type AiReportRepositoryPort } from "../ports/ai-report.repository.port.js";
import type { ReportStatusReadModel } from "../read-models/report-status.read-model.js";

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
  readonly entitlementReader: Pick<EntitlementReaderPort, "can">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly clock: ClockPort;
}

export class GetReportStatusUseCase {
  readonly #dependencies: GetReportStatusDependencies;

  constructor(dependencies: GetReportStatusDependencies) {
    this.#dependencies = dependencies;
  }

  /** timezone은 X-Timezone 헤더이며, 없으면 디스패치와 같은 저장 시간대를 쓴다. */
  async execute(query: {
    readonly userId: string;
    readonly timezone: string | undefined;
  }): Promise<ReportStatusReadModel> {
    const { userId, timezone } = query;
    await assertEntitled(this.#dependencies.entitlementReader, userId, "AI_REPORT");

    const zone =
      timezone ?? (await this.#dependencies.localePreferenceReader.read(userId)).timezone;
    const at = instantToDate(this.#dependencies.clock.now());
    // 달력 날짜를 먼저 정하고 각 경계를 다시 시간대에 적용해 DST offset을 반영한다.
    const localToday = dayjs.utc(dayjs(at).tz(zone).format("YYYY-MM-DD"));
    const readyAt = (date: dayjs.Dayjs) =>
      parseLocalDateTime(date.format("YYYY-MM-DD"), REPORT_READY_TIME, zone);

    const thisMonday = localToday.startOf("isoWeek");
    const nextWeeklyDate = at < readyAt(thisMonday) ? thisMonday : thisMonday.add(1, "week");
    const thisFirst = localToday.startOf("month");
    const nextMonthlyDate = at < readyAt(thisFirst) ? thisFirst : thisFirst.add(1, "month");

    const [latestWeekly, latestMonthly] = await Promise.all([
      this.#dependencies.aiReportRepository.findLatest(UserId.reconstitute(userId), "WEEKLY"),
      this.#dependencies.aiReportRepository.findLatest(UserId.reconstitute(userId), "MONTHLY"),
    ]);

    return {
      nextWeeklyAt: instantFromDate(readyAt(nextWeeklyDate)),
      nextMonthlyAt: instantFromDate(readyAt(nextMonthlyDate)),
      daysUntilWeekly: nextWeeklyDate.diff(localToday, "day"),
      daysUntilMonthly: nextMonthlyDate.diff(localToday, "day"),
      latestWeekly,
      latestMonthly,
    };
  }
}
