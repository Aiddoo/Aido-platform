import { Inject, Injectable, Logger } from "@nestjs/common";
import { match } from "ts-pattern";

import {
  type UsageKey,
  UsageMeterPort,
  USAGE_SUBJECT_ALL,
} from "#api/platform/metering/usage-meter.port";
import { crossedThresholds, usagePeriod } from "#api/platform/metering/usage-period";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { instantToDate } from "#api/shared/domain/time/instant";

import type { WeatherProviderBudgetPort } from "../../application/ports/weather-provider-budget.port.js";
import { WeatherReportAlerts } from "../../application/weather-reports.alerts.js";
import {
  assessWeatherProviderBudget,
  type WeatherProviderBudgetState,
} from "../../domain/weather-provider-budget.domain-service.js";
import {
  WEATHERKIT_MONTHLY_CALL_ALERTS,
  WEATHERKIT_MONTHLY_CALL_LIMIT,
} from "./weather-outbound.policy.js";
import { WeatherKitLogEvent } from "./weatherkit.log-events.js";

const WEATHERKIT_CALL_METER = "weatherkit.call";

/**
 * WeatherKit에 보내는 HTTP 호출을 월 단위로 예약한다. 캐시 밀림으로 호출이 늘어도 무료 한도 전에 경보로 알고,
 * 한도의 90%부터는 리포트를 오래 두게 하며 한도에 닿으면 더 부르지 않는다. 계량 실패는 날씨 응답을 막지 않는다.
 */
@Injectable()
export class WeatherKitUsageMeterAdapter implements WeatherProviderBudgetPort {
  readonly #logger = new Logger(WeatherKitUsageMeterAdapter.name);

  readonly #meter: Pick<UsageMeterPort, "tryReserve">;
  readonly #alert: OperationalAlertPort;
  readonly #clock: ClockPort;
  #state: WeatherProviderBudgetState = "normal";

  constructor(
    @Inject(UsageMeterPort) meter: Pick<UsageMeterPort, "tryReserve">,
    alert: OperationalAlertPort,
    clock: ClockPort,
  ) {
    this.#meter = meter;
    this.#alert = alert;
    this.#clock = clock;
  }

  currentState(): WeatherProviderBudgetState {
    return this.#state;
  }

  async reserveCall(): Promise<boolean> {
    const period = usagePeriod.month(instantToDate(this.#clock.now()));
    const key: UsageKey = {
      meter: WEATHERKIT_CALL_METER,
      periodKey: period,
      subject: USAGE_SUBJECT_ALL,
    };
    try {
      const { isAccepted, total } = await this.#meter.tryReserve(
        key,
        1,
        WEATHERKIT_MONTHLY_CALL_LIMIT,
      );
      this.#state = assessWeatherProviderBudget({
        usedCalls: total,
        monthlyCallLimit: WEATHERKIT_MONTHLY_CALL_LIMIT,
      });
      if (isAccepted) {
        this.#alertCrossings(period, total);
      }
      return isAccepted;
    } catch (error) {
      this.#logger.warn({
        event: WeatherKitLogEvent.USAGE_RECORD_FAILED,
        errorType: toErrorType(error),
      });
      return true;
    }
  }

  #alertCrossings(period: string, total: number): void {
    for (const threshold of crossedThresholds(total, 1, WEATHERKIT_MONTHLY_CALL_ALERTS)) {
      this.#logger.warn({ event: WeatherKitLogEvent.MONTHLY_CALLS_REACHED, period, threshold });
      this.#alert.raise({
        ...WeatherReportAlerts.WEATHERKIT_MONTHLY_CALLS,
        tags: { period },
        details: { threshold, total },
      });
    }
    const before = assessWeatherProviderBudget({
      usedCalls: total - 1,
      monthlyCallLimit: WEATHERKIT_MONTHLY_CALL_LIMIT,
    });
    if (before === this.#state) {
      return;
    }
    this.#logger.warn({
      event: WeatherKitLogEvent.MONTHLY_BUDGET_CHANGED,
      period,
      state: this.#state,
      total,
    });
    match(this.#state)
      .with("normal", () => undefined)
      .with("saving", () =>
        this.#alert.raise({
          ...WeatherReportAlerts.WEATHERKIT_BUDGET_SAVING,
          tags: { period },
          details: { total, limit: WEATHERKIT_MONTHLY_CALL_LIMIT },
        }),
      )
      .with("exhausted", () =>
        this.#alert.raise({
          ...WeatherReportAlerts.WEATHERKIT_BUDGET_EXHAUSTED,
          tags: { period },
          details: { total, limit: WEATHERKIT_MONTHLY_CALL_LIMIT },
        }),
      )
      .exhaustive();
  }
}
