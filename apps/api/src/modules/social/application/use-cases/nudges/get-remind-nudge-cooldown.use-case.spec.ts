import { SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";
import { createSocialInteractionFixture } from "#test/fixtures/social-interactions.fixture";

import { GetRemindNudgeCooldown } from "./get-remind-nudge-cooldown.use-case.js";

describe("GetRemindNudgeCooldown 대상별 쿨다운 조회", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("다른 친구에게 보낸 기록은 대상의 쿨다운을 만들지 않는다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    fixture.nudgeRepository.seedReminder({
      senderId: "sender",
      receiverId: "other",
      createdAt: SOCIAL_TIME,
      message: null,
    });
    // When
    const result = await new GetRemindNudgeCooldown(fixture).execute({
      senderId: "sender",
      receiverId: "receiver",
    });
    // Then
    expect(result).toEqual({ isActive: false, remainingSeconds: 0, cooldownEndsAt: null });
  });
  it.each([
    { name: "종료 직전", secondsBeforeEnd: 1, active: true },
    { name: "종료 시각", secondsBeforeEnd: 0, active: false },
  ])("$name에는 정확한 활성 상태와 종료 시각을 반환한다", async (input) => {
    // Given
    const fixture = createSocialInteractionFixture();
    const createdAt = new Date(SOCIAL_TIME.getTime() - 1 * 3600000 + input.secondsBeforeEnd * 1000);
    fixture.nudgeRepository.seedReminder({
      senderId: "sender",
      receiverId: "receiver",
      createdAt,
      message: null,
    });
    // When
    const result = await new GetRemindNudgeCooldown(fixture).execute({
      senderId: "sender",
      receiverId: "receiver",
    });
    // Then
    expect(result).toEqual({
      isActive: input.active,
      remainingSeconds: input.secondsBeforeEnd,
      cooldownEndsAt: input.active
        ? new Date(SOCIAL_TIME.getTime() + input.secondsBeforeEnd * 1000)
        : null,
    });
  });
});
