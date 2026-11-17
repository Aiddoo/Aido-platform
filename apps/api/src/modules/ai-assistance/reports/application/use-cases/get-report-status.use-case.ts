import {
  assertEntitled,
  type EntitlementReaderPort,
} from "#api/modules/access/feature-grants/access-feature-grants.public";
import { NOTIFICATION_SCHEDULE } from "#api/modules/notification/notification-reminders.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { resolveTimezone } from "#api/shared/domain/time/time-zone-name";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { toZonedInstant } from "#api/shared/domain/time/zoned-time";

import type { UserLocalePreferenceReaderPort } from "../../../generation/application/ports/user-locale-preference.reader.port.js";
import { localDateAt } from "../../../shared/domain/user-calendar.domain-service.js";
import { type AiReportRepositoryPort } from "../ports/ai-report.repository.port.js";
import type { ReportStatusReadModel } from "../read-models/report-status.read-model.js";

const WEEKLY_READY_TIME = Temporal.PlainTime.from(NOTIFICATION_SCHEDULE.WEEKLY_REPORT);
const MONTHLY_READY_TIME = Temporal.PlainTime.from(NOTIFICATION_SCHEDULE.MONTHLY_REPORT);

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
    const owner = UserId.reconstitute(userId);
    await assertEntitled(this.#dependencies.entitlementReader, owner, "AI_REPORT");

    const zone = timezone ?? (await this.#dependencies.localePreferenceReader.read(owner)).timezone;
    const now = this.#dependencies.clock.now();
    const timeZone = TimeZone.reconstitute(resolveTimezone(zone));
    // 달력 날짜를 먼저 정하고 각 경계를 다시 시간대에 적용해 DST offset을 반영한다.
    const localToday = localDateAt(now, zone);
    const readyAt = (date: Temporal.PlainDate, time: Temporal.PlainTime) =>
      toZonedInstant({ date, time, timeZone });
    const isBeforeReady = (date: Temporal.PlainDate, time: Temporal.PlainTime) =>
      Temporal.Instant.compare(now, readyAt(date, time)) < 0;

    const thisMonday = localToday.subtract({ days: localToday.dayOfWeek - 1 });
    const nextWeeklyDate = isBeforeReady(thisMonday, WEEKLY_READY_TIME)
      ? thisMonday
      : thisMonday.add({ weeks: 1 });
    const thisFirst = localToday.with({ day: 1 });
    const nextMonthlyDate = isBeforeReady(thisFirst, MONTHLY_READY_TIME)
      ? thisFirst
      : thisFirst.add({ months: 1 });

    const [latestWeekly, latestMonthly] = await Promise.all([
      this.#dependencies.aiReportRepository.findLatest(owner, "WEEKLY"),
      this.#dependencies.aiReportRepository.findLatest(owner, "MONTHLY"),
    ]);

    return {
      nextWeeklyAt: readyAt(nextWeeklyDate, WEEKLY_READY_TIME),
      nextMonthlyAt: readyAt(nextMonthlyDate, MONTHLY_READY_TIME),
      daysUntilWeekly: localToday.until(nextWeeklyDate).days,
      daysUntilMonthly: localToday.until(nextMonthlyDate).days,
      latestWeekly,
      latestMonthly,
      localToday,
    };
  }
}
