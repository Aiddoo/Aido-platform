import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import { isReminderTimeDue, timezoneContextAt } from "../../domain/local-clock.domain-service.js";
import { ReminderLogEvent } from "../reminders.log-events.js";
import type { SendEveningReminderUseCase } from "./send-evening-reminder.use-case.js";
import type { SendMorningReminderUseCase } from "./send-morning-reminder.use-case.js";

/** 큐 payload 그대로다. 바꾸지 않은 시각은 비어 있다 */
export interface CatchUpChangedReminderHourCommand {
  readonly userId: string;
  readonly timezone: string;
  readonly morningReminderHour?: number;
  readonly morningReminderMinute?: number;
  readonly eveningReminderHour?: number;
  readonly eveningReminderMinute?: number;
}

interface CatchUpChangedReminderHourDependencies {
  readonly clock: Pick<ClockPort, "now">;
  readonly morningReminder: Pick<SendMorningReminderUseCase, "execute">;
  readonly eveningReminder: Pick<SendEveningReminderUseCase, "execute">;
  readonly logger: Pick<ApplicationLoggerPort, "error" | "log">;
}

// 바꾼 리마인더 시각이 지금이면 매분 sweep을 기다리지 않고 그 사용자에게 바로 보낸다
export class CatchUpChangedReminderHourUseCase {
  readonly #dependencies: CatchUpChangedReminderHourDependencies;

  constructor(dependencies: CatchUpChangedReminderHourDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(payload: CatchUpChangedReminderHourCommand): Promise<void> {
    try {
      const timezoneContext = timezoneContextAt(
        this.#dependencies.clock.now(),
        payload.timezone,
        payload.userId,
      );
      const { localHour, localMinute } = timezoneContext;

      const morningMinute = payload.morningReminderMinute ?? 0;
      if (
        payload.morningReminderHour != null &&
        isReminderTimeDue(timezoneContext, {
          hour: payload.morningReminderHour,
          minute: morningMinute,
        })
      ) {
        this.#dependencies.logger.log({
          event: ReminderLogEvent.TIMEZONE_AWARE_REMINDER_CATCH_UP_MORNING,
          userId: payload.userId,
          localHour,
          localMinute,
        });
        await this.#dependencies.morningReminder.execute(timezoneContext);
      }

      const eveningMinute = payload.eveningReminderMinute ?? 0;
      if (
        payload.eveningReminderHour != null &&
        isReminderTimeDue(timezoneContext, {
          hour: payload.eveningReminderHour,
          minute: eveningMinute,
        })
      ) {
        this.#dependencies.logger.log({
          event: ReminderLogEvent.TIMEZONE_AWARE_REMINDER_CATCH_UP_EVENING,
          userId: payload.userId,
          localHour,
          localMinute,
        });
        await this.#dependencies.eveningReminder.execute(timezoneContext);
      }
    } catch {
      this.#dependencies.logger.error({
        event: ReminderLogEvent.TIMEZONE_AWARE_REMINDER_CATCH_UP_FAILED,
        userId: payload.userId,
        errorType: "catch-up-execution",
      });
    }
  }
}
