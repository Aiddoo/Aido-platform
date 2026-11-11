import { localDateIn, resolveTimezone } from "#api/shared/domain/time/time-zone-name";

import type { RetentionStageName } from "./retention.constants.js";

// SQL 후보 조회(due 필터)가 같은 기준을 쓰므로 한 곳에 둔다
export const RETENTION_STAGE_TIMING = {
  d0MinWaitMs: 2 * 60 * 60_000,
  targetDay: { D1: 1, D3: 3, D7: 7 },
  sendLocalTime: { hour: 10, minute: 30 },
} as const;

export interface RetentionStageTiming {
  readonly startedAt: Temporal.Instant;
  readonly now: Temporal.Instant;
  readonly timezone: string;
}

export interface RetentionStageState extends RetentionStageTiming {
  readonly todoCount: number;
  readonly completedCount: number;
  readonly incompleteCount: number;
  readonly returnedWithinWindow: boolean;
  readonly todoActionWithinWindow: boolean;
  readonly activeToday: boolean;
}

export type RetentionStageDecision =
  | { readonly kind: "WAIT" }
  | { readonly kind: "SKIP"; readonly reason: string }
  | {
      readonly kind: "SEND";
      readonly route: "/feed" | "/achievements";
      readonly variantId: string;
    }
  | { readonly kind: "EVALUATE_ONLY"; readonly reason: string };

// false면 아직 결정할 때가 아니다(WAIT). 지난 단계는 처리 시각과 상관없이 결정 대상으로 남는다
export function isRetentionStageDue(
  stage: RetentionStageName,
  timing: RetentionStageTiming,
): boolean {
  const day = localDayDifference(timing.startedAt, timing.now, timing.timezone);
  if (stage === "D0") {
    return (
      day > 0 ||
      timing.now.epochMilliseconds - timing.startedAt.epochMilliseconds >=
        RETENTION_STAGE_TIMING.d0MinWaitMs
    );
  }
  const targetDay = RETENTION_STAGE_TIMING.targetDay[stage];
  const { hour, minute } = RETENTION_STAGE_TIMING.sendLocalTime;
  return (
    day > targetDay ||
    (day === targetDay && isAtOrAfterLocalTime(timing.now, timing.timezone, hour, minute))
  );
}

export function decideRetentionStage(
  stage: RetentionStageName,
  state: RetentionStageState,
): RetentionStageDecision {
  if (!isRetentionStageDue(stage, state)) {
    return { kind: "WAIT" };
  }
  const day = localDayDifference(state.startedAt, state.now, state.timezone);

  if (stage === "D0") {
    if (day > 0) {
      return { kind: "SKIP", reason: "D0_COLLIDES_WITH_D1" };
    }
    return state.todoCount === 0
      ? { kind: "SEND", route: "/feed", variantId: "d0_no_todo" }
      : { kind: "SKIP", reason: "TODO_ALREADY_CREATED" };
  }

  if (day > RETENTION_STAGE_TIMING.targetDay[stage]) {
    return stage === "D7"
      ? { kind: "EVALUATE_ONLY", reason: "D7_SEND_WINDOW_MISSED" }
      : { kind: "SKIP", reason: `${stage}_SEND_WINDOW_MISSED` };
  }

  if (stage === "D1") {
    if (state.todoCount === 0) {
      return { kind: "SEND", route: "/feed", variantId: "d1_no_todo" };
    }
    if (state.incompleteCount > 0 && state.completedCount === 0) {
      return {
        kind: "SEND",
        route: "/feed",
        variantId: "d1_has_todo_no_completion",
      };
    }
    return { kind: "SKIP", reason: "ACTIVATED_BEFORE_D1" };
  }

  if (stage === "D3") {
    return state.returnedWithinWindow && state.todoActionWithinWindow
      ? { kind: "SKIP", reason: "ACTIVE_BEFORE_D3" }
      : { kind: "SEND", route: "/feed", variantId: "d3_restart" };
  }

  if (state.activeToday) {
    return { kind: "EVALUATE_ONLY", reason: "ACTIVE_ON_D7" };
  }
  return state.todoActionWithinWindow
    ? {
        kind: "SEND",
        route: "/achievements",
        variantId: "d7_has_progress",
      }
    : { kind: "SEND", route: "/feed", variantId: "d7_restart" };
}

function localDayDifference(
  from: Temporal.Instant,
  to: Temporal.Instant,
  timezone: string,
): number {
  return localDateIn(to, timezone).since(localDateIn(from, timezone)).days;
}

function isAtOrAfterLocalTime(
  instant: Temporal.Instant,
  timezone: string,
  hour: number,
  minute: number,
): boolean {
  const local = instant.toZonedDateTimeISO(resolveTimezone(timezone));
  return local.hour > hour || (local.hour === hour && local.minute >= minute);
}
