import type { QuotaMeter } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { QuotaWindow } from "../../../shared/domain/quota-window.vo.js";

/**
 * 계량기별 기간 사용량 카운터. AI_PLAN은 출시 앱 /v1/ai/usage·/me와 같은 User.aiUsageCount·aiUsageResetAt을,
 * 나머지 계량기는 QuotaUsage를 센다. 더하고 빼는 연산은 Application이 잡은 사용자 행 잠금 안에서 실행된다.
 */
export abstract class QuotaUsageRepositoryPort {
  /** 그 기간에 쓴 횟수. 기록이 없거나 지난 기간에 기록됐으면 0이다. */
  abstract countUsage(params: {
    readonly userId: UserId;
    readonly meter: QuotaMeter;
    readonly window: QuotaWindow;
  }): Promise<number>;
  /** 한도 안이면 더하고 true. limit null은 무제한이다. */
  abstract addUsageWithinLimit(params: {
    readonly userId: UserId;
    readonly meter: QuotaMeter;
    readonly window: QuotaWindow;
    readonly amount: number;
    readonly limit: number | null;
    readonly now: Temporal.Instant;
  }): Promise<boolean>;
  /** 그 기간 카운터가 남아 있을 때만 빼고 true. 지난 기간의 사용량은 이미 0으로 보이므로 건드리지 않는다. */
  abstract subtractUsage(params: {
    readonly userId: UserId;
    readonly meter: QuotaMeter;
    readonly periodKey: string;
    readonly amount: number;
    readonly now: Temporal.Instant;
  }): Promise<boolean>;
}
