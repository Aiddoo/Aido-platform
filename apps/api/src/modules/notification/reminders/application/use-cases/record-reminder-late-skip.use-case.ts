import { WindowedCounter } from "#api/shared/application/alerts/windowed-counter";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import type { ReminderLateSkipReason } from "../../domain/reminder-plan.domain-service.js";
import { ReminderAlerts } from "../reminders.alerts.js";
import { ReminderLogEvent } from "../reminders.log-events.js";

/**
 * 늦어서 버린 리마인더가 한 시간(REMINDER_LATE_SKIP_WINDOW_MS) 안에 이만큼 쌓이면 경보한다.
 * 배포로 worker가 잠깐 멈춘 뒤 몇 건은 늘 생기므로 그보다 크게 잡는다.
 */
export const REMINDER_LATE_SKIP_THRESHOLD = 20;
export const REMINDER_LATE_SKIP_WINDOW_MS = 60 * 60_000;
const LATE_SKIP_COUNTER_KEY = "late-skip";

export interface ReminderLateSkip {
  readonly todoId: number;
  readonly userId: string;
  readonly stage: string;
  readonly reason: ReminderLateSkipReason;
  /** 울려야 했던 시각 */
  readonly fireAt: Temporal.Instant;
  readonly now: Temporal.Instant;
}

interface RecordReminderLateSkipDependencies {
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
  readonly alert: Pick<OperationalAlertPort, "raise">;
}

// 늦어서 버린 리마인더를 남기고 한 시간 창에서 기준에 닿으면 경보한다. 창은 프로세스 메모리에 둔다
export class RecordReminderLateSkipUseCase {
  readonly #lateSkips = new WindowedCounter(REMINDER_LATE_SKIP_WINDOW_MS);
  readonly #dependencies: RecordReminderLateSkipDependencies;

  constructor(dependencies: RecordReminderLateSkipDependencies) {
    this.#dependencies = dependencies;
  }

  execute({ todoId, userId, stage, reason, fireAt, now }: ReminderLateSkip): void {
    this.#dependencies.logger.warn({
      event: ReminderLogEvent.TODO_REMINDER_LATE_SKIPPED,
      todoId,
      userId,
      stage,
      reason,
      lateMinutes: fireAt.until(now, { largestUnit: "minutes" }).minutes,
    });
    // 창 안에서 기준에 닿는 순간 한 번만 올린다
    if (
      this.#lateSkips.add(LATE_SKIP_COUNTER_KEY, now.epochMilliseconds) ===
      REMINDER_LATE_SKIP_THRESHOLD
    ) {
      this.#dependencies.alert.raise({
        ...ReminderAlerts.LATE_SKIPS_HIGH,
        details: {
          skippedCount: REMINDER_LATE_SKIP_THRESHOLD,
          windowMinutes: REMINDER_LATE_SKIP_WINDOW_MS / 60_000,
        },
      });
    }
  }
}
