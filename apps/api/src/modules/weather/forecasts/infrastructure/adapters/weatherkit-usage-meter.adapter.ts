import { Inject, Injectable, Logger } from "@nestjs/common";

import { UsageMeterPort, USAGE_SUBJECT_ALL } from "#api/platform/metering/usage-meter.port";
import { crossedThresholds, usagePeriod } from "#api/platform/metering/usage-period";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { instantToDate } from "#api/shared/domain/time/instant";

import { ForecastAlerts } from "../../application/forecasts.alerts.js";
import { WeatherKitLogEvent } from "../weatherkit.log-events.js";
import { WEATHERKIT_MONTHLY_CALL_ALERTS } from "./weather-outbound.policy.js";

const WEATHERKIT_CALL_METER = "weatherkit.call";

/**
 * WeatherKit에 실제로 보낸 HTTP 호출을 월 단위로 센다. 캐시 밀림으로 호출이 늘어도 무료 한도에
 * 닿기 전에 경보로 알 수 있다. 계량 실패는 날씨 응답을 막지 않는다.
 */
@Injectable()
export class WeatherKitUsageMeterAdapter {
  readonly #logger = new Logger(WeatherKitUsageMeterAdapter.name);

  readonly #meter: Pick<UsageMeterPort, "add">;
  readonly #alert: OperationalAlertPort;
  readonly #clock: ClockPort;

  constructor(
    @Inject(UsageMeterPort) meter: Pick<UsageMeterPort, "add">,
    alert: OperationalAlertPort,
    clock: ClockPort,
  ) {
    this.#meter = meter;
    this.#alert = alert;
    this.#clock = clock;
  }

  async recordCall(): Promise<void> {
    const period = usagePeriod.month(instantToDate(this.#clock.now()));
    try {
      const [total = 0] = await this.#meter.add([
        {
          key: { meter: WEATHERKIT_CALL_METER, periodKey: period, subject: USAGE_SUBJECT_ALL },
          amount: 1,
        },
      ]);
      for (const threshold of crossedThresholds(total, 1, WEATHERKIT_MONTHLY_CALL_ALERTS)) {
        this.#logger.warn({ event: WeatherKitLogEvent.MONTHLY_CALLS_REACHED, period, threshold });
        this.#alert.raise({
          ...ForecastAlerts.WEATHERKIT_MONTHLY_CALLS,
          tags: { period },
          details: { threshold, total },
        });
      }
    } catch (error) {
      this.#logger.warn({
        event: WeatherKitLogEvent.USAGE_RECORD_FAILED,
        errorType: toErrorType(error),
      });
    }
  }
}
