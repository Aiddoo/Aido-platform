import {
  ReminderNudge,
  type ReminderNudgePrimitives,
} from "#api/modules/social/nudges/domain/reminder-nudge.aggregate";

import {
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_RECEIVER_ID,
  NUDGE_FIXTURE_SENDER_ID,
} from "./nudge.fixture.js";

export function createReminderNudgeFixture(
  overrides: Partial<ReminderNudgePrimitives> = {},
): ReminderNudge {
  return ReminderNudge.reconstitute({
    id: 1,
    senderId: NUDGE_FIXTURE_SENDER_ID,
    receiverId: NUDGE_FIXTURE_RECEIVER_ID,
    message: null,
    createdAt: NUDGE_FIXTURE_NOW,
    ...overrides,
  });
}
