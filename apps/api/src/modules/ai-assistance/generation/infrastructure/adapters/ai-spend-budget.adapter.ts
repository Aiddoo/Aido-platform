import { AI_PROVIDER_IDS } from "@aido/api/vocabulary";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import {
  USAGE_METER,
  USAGE_SUBJECT_ALL,
  type UsageKey,
  type UsageMeterPort,
} from "#api/platform/metering/interfaces/usage-meter.interface";
import { crossedThresholds, usagePeriod } from "#api/platform/metering/usage-period";
import type { AlertDefinition } from "#api/shared/application/alerts/define-alerts";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  OPERATIONAL_ALERT,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { instantToDate } from "#api/shared/domain/time/instant";

import {
  type AiAssistanceGenerationConfig,
  aiAssistanceGenerationConfig,
} from "../../ai-assistance-generation.config.js";
import { AiAlerts } from "../../application/ai-generation.alerts.js";
import {
  AI_SPEND_TIERS,
  type AiSpend,
  type AiSpendTier,
  type AiSpendDecision,
  type AiTaskClass,
  decideAiSpend,
} from "../../domain/ai-spend.domain-service.js";
import { hasKnownPricing } from "./ai-model-pricing.constants.js";
import { AiGuardLogEvent } from "./ai-provider.log-events.js";

/** 추정 비용 누적(micro-USD). subject "*"는 전역, 사용자 id는 사용자 일 예산이다. */
const AI_SPEND_METER = "ai.spend";

type SpendBudgetConfig = Pick<AiAssistanceGenerationConfig, "providers" | "enabled" | "budget">;

// 경고 기준선은 사람이 볼 것이고, 배경·전체 중단 기준선은 기능이 멈춘 것이라 심각도가 다르다
const SPEND_TIER_ALERTS = {
  alert: AiAlerts.SPEND_THRESHOLD_REACHED,
  background: AiAlerts.SPEND_BACKGROUND_HALTED,
  halt: AiAlerts.SPEND_HALTED,
} satisfies Record<AiSpendTier, AlertDefinition>;

/** 오늘 비용을 기억하는 사용자 수 상한. 넘으면 오래 쓰지 않은 사용자부터 지우고 다음에 DB에서 다시 읽는다. */
const USER_SPEND_CACHE_LIMIT = 10_000;

interface GlobalSnapshot {
  readonly day: string;
  readonly month: string;
  daily: number;
  monthly: number;
}

/**
 * 전역 일·월, 사용자 일 추정 비용을 OutboundUsage로 세고 생성 전에 예산을 확인한다. 사용자 일 예산은 모든
 * 요금제(ADMIN 포함)에 같고 access 횟수 한도와 다른 상한이다.
 * 판단은 프로세스 메모리 스냅샷으로 하고, 요청이 끝날 때 세 행을 한 번에 더한 RETURNING 값으로 갱신한다.
 * 진행 중인 호출은 끝난 뒤에 더해지므로 상한은 그만큼 넘을 수 있다. 계량 오류는 생성을 막지 않는다.
 */
@Injectable()
export class AiSpendBudgetAdapter implements OnModuleInit {
  readonly #logger = new Logger(AiSpendBudgetAdapter.name);
  #global: GlobalSnapshot | null = null;
  /** #usersDay 하루의 사용자별 비용 */
  readonly #users = new Map<string, number>();
  #usersDay: string | null = null;

  readonly #config: SpendBudgetConfig;
  readonly #meter: Pick<UsageMeterPort, "add" | "read">;
  readonly #alert: OperationalAlertPort;
  readonly #clock: ClockPort;

  constructor(
    @Inject(aiAssistanceGenerationConfig.KEY) config: SpendBudgetConfig,
    @Inject(USAGE_METER) meter: Pick<UsageMeterPort, "add" | "read">,
    @Inject(OPERATIONAL_ALERT) alert: OperationalAlertPort,
    clock: ClockPort,
  ) {
    this.#config = config;
    this.#meter = meter;
    this.#alert = alert;
    this.#clock = clock;
  }

  /** 가격표에 없는 모델은 호출마다 최고 단가로 잡혀 예산이 빠르게 닳는다. 전체 중단 전에 기동 때 알린다. */
  onModuleInit(): void {
    const unpriced = AI_PROVIDER_IDS.filter((provider) => {
      const { apiKey, model } = this.#config.providers[provider];
      return apiKey != null && !hasKnownPricing(`${provider}:${model}`);
    });
    if (unpriced.length > 0) {
      this.#alert.raise({
        ...AiAlerts.MODEL_PRICING_UNKNOWN,
        details: { providers: unpriced.join(",") },
      });
    }
  }

  async decide(input: {
    readonly taskClass: AiTaskClass;
    readonly userId: string | null;
  }): Promise<AiSpendDecision> {
    const { enabled: enabledByClass, budget } = this.#config;
    const enabled = enabledByClass[input.taskClass];
    const spend = enabled ? await this.#readSpend(input.userId) : EMPTY_SPEND;
    return decideAiSpend({
      taskClass: input.taskClass,
      isEnabled: enabled,
      spend,
      limits: budget,
    });
  }

  async record(userId: string | null, microUsd: number): Promise<void> {
    if (microUsd <= 0) {
      return;
    }
    const at = instantToDate(this.#clock.now());
    const day = usagePeriod.day(at);
    const month = usagePeriod.month(at);
    try {
      const [daily = 0, monthly = 0, user] = await this.#meter.add([
        { key: buildSpendKey(day, USAGE_SUBJECT_ALL), amount: microUsd },
        { key: buildSpendKey(month, USAGE_SUBJECT_ALL), amount: microUsd },
        ...(userId == null ? [] : [{ key: buildSpendKey(day, userId), amount: microUsd }]),
      ]);
      this.#global = { day, month, daily, monthly };
      if (userId != null && user != null) {
        this.#rememberUser(day, userId, user);
      }
      this.#alertCrossed({ day, month, daily, monthly, microUsd });
    } catch (error) {
      this.#logger.error({
        event: AiGuardLogEvent.SPEND_RECORD_FAILED,
        microUsd,
        errorType: toErrorType(error),
      });
    }
  }

  async #readSpend(userId: string | null): Promise<AiSpend> {
    const at = instantToDate(this.#clock.now());
    const day = usagePeriod.day(at);
    const month = usagePeriod.month(at);
    try {
      const global = await this.#readGlobal(day, month);
      return {
        globalDailyMicroUsd: global.daily,
        globalMonthlyMicroUsd: global.monthly,
        userDailyMicroUsd: userId == null ? null : await this.#readUser(day, userId),
      };
    } catch (error) {
      this.#logger.error({
        event: AiGuardLogEvent.SPEND_READ_FAILED,
        errorType: toErrorType(error),
      });
      return { ...EMPTY_SPEND, userDailyMicroUsd: userId == null ? null : 0 };
    }
  }

  async #readGlobal(day: string, month: string): Promise<GlobalSnapshot> {
    const cached = this.#global;
    if (cached != null && cached.day === day && cached.month === month) {
      return cached;
    }
    const [daily = 0, monthly = 0] = await this.#meter.read([
      buildSpendKey(day, USAGE_SUBJECT_ALL),
      buildSpendKey(month, USAGE_SUBJECT_ALL),
    ]);
    this.#global = { day, month, daily, monthly };
    return this.#global;
  }

  async #readUser(day: string, userId: string): Promise<number> {
    const cached = this.#usersDay === day ? this.#users.get(userId) : undefined;
    if (cached != null) {
      return cached;
    }
    const [used = 0] = await this.#meter.read([buildSpendKey(day, userId)]);
    this.#rememberUser(day, userId, used);
    return used;
  }

  #rememberUser(day: string, userId: string, used: number): void {
    if (this.#usersDay !== day) {
      this.#users.clear();
      this.#usersDay = day;
    }
    this.#users.delete(userId);
    this.#users.set(userId, used);
    for (const oldest of this.#users.keys()) {
      if (this.#users.size <= USER_SPEND_CACHE_LIMIT) {
        break;
      }
      this.#users.delete(oldest);
    }
  }

  /** 원자적 누적값으로 기준선을 처음 넘긴 요청 하나만 기간당 한 번 경보를 올린다. */
  #alertCrossed(input: {
    readonly day: string;
    readonly month: string;
    readonly daily: number;
    readonly monthly: number;
    readonly microUsd: number;
  }): void {
    const { budget } = this.#config;
    for (const tier of AI_SPEND_TIERS) {
      const windows = [
        {
          window: "daily",
          period: input.day,
          total: input.daily,
          limit: budget[tier].dailyMicroUsd,
        },
        {
          window: "monthly",
          period: input.month,
          total: input.monthly,
          limit: budget[tier].monthlyMicroUsd,
        },
      ] as const;
      for (const { window, period, total, limit } of windows) {
        if (crossedThresholds(total, input.microUsd, [limit]).length === 0) {
          continue;
        }
        const fields = { tier, window, period, totalMicroUsd: total, limitMicroUsd: limit };
        this.#logger.warn({ event: AiGuardLogEvent.SPEND_THRESHOLD_REACHED, ...fields });
        this.#alert.raise({
          ...SPEND_TIER_ALERTS[tier],
          tags: { tier, window },
          details: fields,
        });
      }
    }
  }
}

const EMPTY_SPEND: AiSpend = {
  globalDailyMicroUsd: 0,
  globalMonthlyMicroUsd: 0,
  userDailyMicroUsd: null,
};

function buildSpendKey(periodKey: string, subject: string): UsageKey {
  return { meter: AI_SPEND_METER, periodKey, subject };
}
