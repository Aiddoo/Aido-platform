/** 사용자가 결과를 기다리는 요청(interactive)과 잡이 만드는 결과(background). 동시성·재시도·예산을 나눈다. */
const AI_TASK_CLASSES = ["interactive", "background"] as const;

export type AiTaskClass = (typeof AI_TASK_CLASSES)[number];

/** 추정 비용(micro-USD) 기준선. alert는 경고만, background는 배경 작업 중단, halt는 전체 중단이다. */
export interface AiSpendLimits {
  readonly alert: AiSpendWindowLimits;
  readonly background: AiSpendWindowLimits;
  readonly halt: AiSpendWindowLimits;
  readonly userDailyMicroUsd: number;
}

interface AiSpendWindowLimits {
  readonly dailyMicroUsd: number;
  readonly monthlyMicroUsd: number;
}

export const AI_SPEND_TIERS = ["alert", "background", "halt"] as const;

export type AiSpendTier = (typeof AI_SPEND_TIERS)[number];

/** 지금까지 기록된 추정 비용. 진행 중인 호출은 끝날 때 더해진다. */
export interface AiSpend {
  readonly globalDailyMicroUsd: number;
  readonly globalMonthlyMicroUsd: number;
  /** 시스템 호출이면 null */
  readonly userDailyMicroUsd: number | null;
}

const AI_SPEND_HALT_REASONS = ["kill-switch", "daily-budget", "monthly-budget"] as const;

type AiSpendHaltReason = (typeof AI_SPEND_HALT_REASONS)[number];

export type AiSpendDecision =
  | { readonly type: "allowed" }
  | {
      readonly type: "halted";
      readonly reason: AiSpendHaltReason;
    }
  | { readonly type: "user-limited" };

/** 업체를 부르기 전에 킬 스위치·전역 예산·사용자 일 예산으로 이번 생성을 허용할지 정한다. */
export function decideAiSpend(input: {
  readonly taskClass: AiTaskClass;
  /** 킬 스위치(AI_GENERATION_MODE)가 이 분류의 생성을 켜 두었는지 */
  readonly isEnabled: boolean;
  readonly spend: AiSpend;
  readonly limits: AiSpendLimits;
}): AiSpendDecision {
  const { taskClass, isEnabled: enabled, spend, limits } = input;
  if (!enabled) {
    return { type: "halted", reason: "kill-switch" };
  }
  const window = taskClass === "background" ? limits.background : limits.halt;
  if (spend.globalDailyMicroUsd >= Math.min(window.dailyMicroUsd, limits.halt.dailyMicroUsd)) {
    return { type: "halted", reason: "daily-budget" };
  }
  if (
    spend.globalMonthlyMicroUsd >= Math.min(window.monthlyMicroUsd, limits.halt.monthlyMicroUsd)
  ) {
    return { type: "halted", reason: "monthly-budget" };
  }
  if (spend.userDailyMicroUsd != null && spend.userDailyMicroUsd >= limits.userDailyMicroUsd) {
    return { type: "user-limited" };
  }
  return { type: "allowed" };
}
