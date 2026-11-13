import {
  ReminderNudge,
  type ReminderNudgePrimitives,
} from "#api/modules/social/reminder-nudges/domain/reminder-nudge.aggregate";

// 서울 2026-07-26 09:30
export const REMINDER_NUDGE_FIXTURE_NOW = Temporal.Instant.from("2026-07-26T00:30:00Z");
export const REMINDER_NUDGE_FIXTURE_TODAY = Temporal.PlainDate.from("2026-07-26");
export const REMINDER_NUDGE_FIXTURE_SENDER_ID = "clz7x5p8k0211qz0z8z8z8z8z";
export const REMINDER_NUDGE_FIXTURE_RECEIVER_ID = "clz7x5p8k0212qz0z8z8z8z8z";
export const REMINDER_NUDGE_FIXTURE_OTHER_USER_ID = "clz7x5p8k0213qz0z8z8z8z8z";

// 받는 친구의 할 일. planning이 쓰는 행이라 저장소 밖에서 넣는다
export interface ReminderTargetTodoSeed {
  readonly ownerId: string;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate | null;
}

export function createReminderTargetTodoSeed(
  overrides: Partial<ReminderTargetTodoSeed> = {},
): ReminderTargetTodoSeed {
  return {
    ownerId: REMINDER_NUDGE_FIXTURE_RECEIVER_ID,
    startDate: REMINDER_NUDGE_FIXTURE_TODAY,
    endDate: null,
    ...overrides,
  };
}

export function createReminderNudgeFixture(
  overrides: Partial<ReminderNudgePrimitives> = {},
): ReminderNudge {
  return ReminderNudge.reconstitute({
    id: 1,
    senderId: REMINDER_NUDGE_FIXTURE_SENDER_ID,
    receiverId: REMINDER_NUDGE_FIXTURE_RECEIVER_ID,
    message: null,
    createdAt: REMINDER_NUDGE_FIXTURE_NOW,
    ...overrides,
  });
}
