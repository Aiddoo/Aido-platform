import {
  USAGE_SUBJECT_ALL,
  type UsageKey,
  type UsageMeterPort,
} from "#api/platform/metering/usage-meter.port";
import { crossedThresholds, usagePeriod } from "#api/platform/metering/usage-period";
import type { AlertDefinition } from "#api/shared/application/alerts/define-alerts";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { instantToDate } from "#api/shared/domain/time/instant";

import { EmailAlerts } from "../../application/email.alerts.js";
import { EmailDeliveryLogEvent } from "../../application/email.log-events.js";
import {
  EmailBudgetPort,
  type EmailBudgetReservation,
} from "../../application/ports/email-budget.port.js";
import type { EmailQuotaScope } from "../../application/ports/email-sender.port.js";
import {
  emailBudgetAlertThresholds,
  resolveEmailBudgetLimits,
} from "../../domain/email-budget.domain-service.js";
import type { EmailPriority } from "../../domain/email-delivery.constants.js";
import { EMAIL_SEND_BUDGET } from "./email-budget.constants.js";

export const EMAIL_SENT_METER = "email.sent";
const EMAIL_EXHAUSTED_ALERT_METER = "email.alert.exhausted";
const EMAIL_BUDGET_ALERT_THRESHOLDS = emailBudgetAlertThresholds(EMAIL_SEND_BUDGET);

interface MeteredEmailBudgetDependencies {
  readonly meter: Pick<UsageMeterPort, "tryReserve" | "release" | "read" | "add">;
  readonly alert: Pick<OperationalAlertPort, "raise">;
  readonly clock: Pick<ClockPort, "now">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

/** EmailBudgetPort의 사용량 계량기 어댑터. 일·월 건수를 원자적으로 예약한다. */
export class MeteredEmailBudgetAdapter extends EmailBudgetPort {
  readonly #dependencies: MeteredEmailBudgetDependencies;

  constructor(dependencies: MeteredEmailBudgetDependencies) {
    super();
    this.#dependencies = dependencies;
  }

  async reserve(priority: EmailPriority): Promise<EmailBudgetReservation> {
    const limits = resolveEmailBudgetLimits(priority, EMAIL_SEND_BUDGET);
    const { day, month } = this.#keys();
    try {
      const daily = await this.#dependencies.meter.tryReserve(day, 1, limits.daily);
      if (!daily.isAccepted) {
        await this.#alertExhausted("daily", day);
        return "exhausted";
      }
      const monthly = await this.#dependencies.meter.tryReserve(month, 1, limits.monthly);
      if (!monthly.isAccepted) {
        await this.#dependencies.meter.release(day, 1);
        await this.#alertExhausted("monthly", month);
        return "exhausted";
      }
      this.#alertNear(
        crossedThresholds(daily.total, 1, [EMAIL_BUDGET_ALERT_THRESHOLDS.daily]),
        EmailAlerts.DAILY_BUDGET_NEAR,
        { period: day.periodKey, total: daily.total },
      );
      this.#alertNear(
        crossedThresholds(monthly.total, 1, [EMAIL_BUDGET_ALERT_THRESHOLDS.monthly]),
        EmailAlerts.MONTHLY_BUDGET_NEAR,
        { period: month.periodKey, total: monthly.total },
      );
      return "reserved";
    } catch (error) {
      this.#logMeterFailure(error);
      return "reserved";
    }
  }

  /** 공급자에 보내지 못하고 끝난 메일의 예약을 돌려준다. */
  async release(): Promise<void> {
    const { day, month } = this.#keys();
    try {
      await this.#dependencies.meter.release(day, 1);
      await this.#dependencies.meter.release(month, 1);
    } catch (error) {
      this.#logMeterFailure(error);
    }
  }

  /** 공급자가 한도를 넘었다고 알려 왔으니 우리 계량도 그 한도까지 채워 더 보내지 않게 맞춘다. */
  async settleProviderQuotaExhausted(scope: EmailQuotaScope): Promise<void> {
    const { day, month } = this.#keys();
    const [key, limit] =
      scope === "daily"
        ? [day, EMAIL_SEND_BUDGET.quota.daily]
        : [month, EMAIL_SEND_BUDGET.quota.monthly];
    try {
      const [total = 0] = await this.#dependencies.meter.read([key]);
      if (total < limit) {
        await this.#dependencies.meter.add([{ key, amount: limit - total }]);
      }
    } catch (error) {
      this.#logMeterFailure(error);
    }
    this.#dependencies.alert.raise({
      ...EmailAlerts.PROVIDER_QUOTA_EXHAUSTED,
      tags: { scope },
    });
  }

  #keys(): { day: UsageKey; month: UsageKey } {
    const at = instantToDate(this.#dependencies.clock.now());
    return {
      day: { meter: EMAIL_SENT_METER, periodKey: usagePeriod.day(at), subject: USAGE_SUBJECT_ALL },
      month: {
        meter: EMAIL_SENT_METER,
        periodKey: usagePeriod.month(at),
        subject: USAGE_SUBJECT_ALL,
      },
    };
  }

  #alertNear(
    crossed: readonly number[],
    alert: AlertDefinition,
    details: Readonly<Record<string, string | number>>,
  ): void {
    for (const threshold of crossed) {
      this.#dependencies.alert.raise({
        ...alert,
        details: { ...details, threshold },
      });
    }
  }

  /** 기간마다 한 번만 올린다. 한도에 막힌 메일이 이어져도 경보가 쏟아지지 않는다. */
  async #alertExhausted(scope: EmailQuotaScope, key: UsageKey): Promise<void> {
    const once = await this.#dependencies.meter.tryReserve(
      {
        meter: `${EMAIL_EXHAUSTED_ALERT_METER}.${scope}`,
        periodKey: key.periodKey,
        subject: key.subject,
      },
      1,
      1,
    );
    if (once.isAccepted) {
      this.#dependencies.alert.raise({
        ...EmailAlerts.BUDGET_EXHAUSTED,
        tags: { scope },
        details: { period: key.periodKey },
      });
    }
  }

  #logMeterFailure(error: unknown): void {
    this.#dependencies.logger.warn({
      event: EmailDeliveryLogEvent.BUDGET_METER_FAILED,
      errorType: toErrorType(error),
    });
  }
}
