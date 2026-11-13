import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryReminderNudgeRepository } from "#test/doubles/social/in-memory-reminder-nudge.repository";
import {
  createReminderNudgeFixture,
  REMINDER_NUDGE_FIXTURE_NOW,
  REMINDER_NUDGE_FIXTURE_OTHER_USER_ID,
  REMINDER_NUDGE_FIXTURE_RECEIVER_ID,
  REMINDER_NUDGE_FIXTURE_SENDER_ID,
} from "#test/fixtures/social/reminder-nudge.fixture";

import { GetReminderNudgeCooldownUseCase } from "./get-reminder-nudge-cooldown.use-case.js";

const QUERY = {
  senderId: REMINDER_NUDGE_FIXTURE_SENDER_ID,
  receiverId: REMINDER_NUDGE_FIXTURE_RECEIVER_ID,
};

describe("GetReminderNudgeCooldownUseCase", () => {
  it("그 친구에게 마지막으로 보낸 리마인드부터 1시간이다", async () => {
    // Given
    const useCase = new GetReminderNudgeCooldownUseCase({
      reminderNudgeRepository: new InMemoryReminderNudgeRepository([
        createReminderNudgeFixture({
          createdAt: REMINDER_NUDGE_FIXTURE_NOW.subtract({ minutes: 59 }),
        }),
      ]),
      clock: new FixedClock(REMINDER_NUDGE_FIXTURE_NOW),
    });

    // When
    const cooldown = await useCase.execute(QUERY);

    // Then
    expect(cooldown).toEqual({
      isActive: true,
      remainingSeconds: 60,
      endsAt: REMINDER_NUDGE_FIXTURE_NOW.add({ minutes: 1 }),
    });
  });

  it("다른 친구에게 보낸 리마인드는 이 친구의 쿨다운을 만들지 않는다", async () => {
    // Given
    const useCase = new GetReminderNudgeCooldownUseCase({
      reminderNudgeRepository: new InMemoryReminderNudgeRepository([
        createReminderNudgeFixture({ receiverId: REMINDER_NUDGE_FIXTURE_OTHER_USER_ID }),
      ]),
      clock: new FixedClock(REMINDER_NUDGE_FIXTURE_NOW),
    });

    // When
    const cooldown = await useCase.execute(QUERY);

    // Then
    expect(cooldown).toEqual({ isActive: false, remainingSeconds: 0, endsAt: null });
  });
});
