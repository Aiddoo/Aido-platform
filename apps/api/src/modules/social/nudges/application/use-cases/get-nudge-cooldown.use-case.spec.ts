import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryNudgeRepository } from "#test/doubles/social/in-memory-nudge.repository";
import {
  createNudgeFixture,
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_OTHER_USER_ID,
  NUDGE_FIXTURE_RECEIVER_ID,
  NUDGE_FIXTURE_SENDER_ID,
} from "#test/fixtures/social/nudge.fixture";
import { createReminderNudgeFixture } from "#test/fixtures/social/reminder-nudge.fixture";

import { GetNudgeCooldownUseCase } from "./get-nudge-cooldown.use-case.js";
import { GetRemindNudgeCooldownUseCase } from "./get-remind-nudge-cooldown.use-case.js";

const QUERY = { senderId: NUDGE_FIXTURE_SENDER_ID, receiverId: NUDGE_FIXTURE_RECEIVER_ID };

describe("콕 쿨다운 조회", () => {
  it("다른 친구에게 보낸 콕은 이 친구의 쿨다운을 만들지 않는다", async () => {
    // Given
    const useCase = new GetNudgeCooldownUseCase({
      nudgeRepository: new InMemoryNudgeRepository([
        createNudgeFixture({ receiverId: NUDGE_FIXTURE_OTHER_USER_ID }),
      ]),
      clock: new FixedClock(NUDGE_FIXTURE_NOW),
    });

    // When
    const cooldown = await useCase.execute(QUERY);

    // Then
    expect(cooldown).toEqual({ isActive: false, remainingSeconds: 0, endsAt: null });
  });

  it.each([
    { name: "끝나기 1초 전", secondsBeforeEnd: 1, isActive: true },
    { name: "끝나는 시각", secondsBeforeEnd: 0, isActive: false },
  ])(
    "$name에는 그 친구에게 마지막으로 보낸 콕 기준 활성 여부와 끝나는 시각을 준다",
    async ({ secondsBeforeEnd, isActive }) => {
      // Given
      const createdAt = NUDGE_FIXTURE_NOW.subtract({ hours: 24 }).add({
        seconds: secondsBeforeEnd,
      });
      const useCase = new GetNudgeCooldownUseCase({
        nudgeRepository: new InMemoryNudgeRepository([createNudgeFixture({ createdAt })]),
        clock: new FixedClock(NUDGE_FIXTURE_NOW),
      });

      // When
      const cooldown = await useCase.execute(QUERY);

      // Then
      expect(cooldown).toEqual({
        isActive,
        remainingSeconds: secondsBeforeEnd,
        endsAt: isActive ? NUDGE_FIXTURE_NOW.add({ seconds: secondsBeforeEnd }) : null,
      });
    },
  );

  it("리마인드 콕은 그 친구에게 마지막으로 보낸 리마인드부터 1시간이다", async () => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    await nudgeRepository.saveReminder(
      createReminderNudgeFixture({ createdAt: NUDGE_FIXTURE_NOW.subtract({ minutes: 59 }) }),
    );
    const useCase = new GetRemindNudgeCooldownUseCase({
      nudgeRepository,
      clock: new FixedClock(NUDGE_FIXTURE_NOW),
    });

    // When
    const cooldown = await useCase.execute(QUERY);

    // Then
    expect(cooldown).toEqual({
      isActive: true,
      remainingSeconds: 60,
      endsAt: NUDGE_FIXTURE_NOW.add({ minutes: 1 }),
    });
  });
});
