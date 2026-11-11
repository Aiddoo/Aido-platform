import type { TodoVisibility } from "@aido/api/vocabulary";

import { Nudge, type NudgePrimitives } from "#api/modules/social/nudges/domain/nudge.aggregate";

// 서울 2026-07-26 09:30
export const NUDGE_FIXTURE_NOW = Temporal.Instant.from("2026-07-26T00:30:00Z");
export const NUDGE_FIXTURE_TODAY = Temporal.PlainDate.from("2026-07-26");
export const NUDGE_FIXTURE_SENDER_ID = "clz7x5p8k0201qz0z8z8z8z8z";
export const NUDGE_FIXTURE_RECEIVER_ID = "clz7x5p8k0202qz0z8z8z8z8z";
export const NUDGE_FIXTURE_OTHER_USER_ID = "clz7x5p8k0203qz0z8z8z8z8z";

// 콕 대상 할 일. planning이 쓰는 행이라 저장소 밖에서 넣는다
export interface NudgeTodoSeed {
  readonly ownerId: string;
  readonly title: string;
  readonly completed: boolean;
  readonly visibility: TodoVisibility;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate | null;
}

export function createNudgeTodoSeed(overrides: Partial<NudgeTodoSeed> = {}): NudgeTodoSeed {
  return {
    ownerId: NUDGE_FIXTURE_RECEIVER_ID,
    title: "운동하기",
    completed: false,
    visibility: "PUBLIC",
    startDate: NUDGE_FIXTURE_TODAY,
    endDate: null,
    ...overrides,
  };
}

export function createNudgeFixture(overrides: Partial<NudgePrimitives> = {}): Nudge {
  return Nudge.reconstitute({
    id: 1,
    senderId: NUDGE_FIXTURE_SENDER_ID,
    receiverId: NUDGE_FIXTURE_RECEIVER_ID,
    todoId: 1,
    message: null,
    readAt: null,
    createdAt: NUDGE_FIXTURE_NOW,
    replyKind: null,
    repliedAt: null,
    replyUpdatedAt: null,
    thankedAt: null,
    ...overrides,
  });
}
