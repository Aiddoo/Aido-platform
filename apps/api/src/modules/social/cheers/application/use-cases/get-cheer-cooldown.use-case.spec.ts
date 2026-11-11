import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryCheerRepository } from "#test/doubles/social/in-memory-cheer.repository";
import {
  CHEER_FIXTURE_NOW,
  CHEER_FIXTURE_OTHER_USER_ID,
  CHEER_FIXTURE_RECEIVER_ID,
  CHEER_FIXTURE_SENDER_ID,
  createCheerFixture,
} from "#test/fixtures/social/cheer.fixture";

import { GetCheerCooldownUseCase } from "./get-cheer-cooldown.use-case.js";

function createUseCase(cheerRepository: InMemoryCheerRepository): GetCheerCooldownUseCase {
  return new GetCheerCooldownUseCase({
    cheerRepository,
    clock: new FixedClock(CHEER_FIXTURE_NOW),
  });
}

const QUERY = { senderId: CHEER_FIXTURE_SENDER_ID, receiverId: CHEER_FIXTURE_RECEIVER_ID };

describe("GetCheerCooldownUseCase — 친구별 응원 쿨다운", () => {
  it("다른 친구에게 보낸 응원은 이 친구의 쿨다운을 만들지 않는다", async () => {
    // Given
    const useCase = createUseCase(
      new InMemoryCheerRepository([
        createCheerFixture({ receiverId: CHEER_FIXTURE_OTHER_USER_ID }),
      ]),
    );

    // When
    const cooldown = await useCase.execute(QUERY);

    // Then
    expect(cooldown).toEqual({ isActive: false, remainingSeconds: 0, endsAt: null });
  });

  it.each([
    { name: "끝나기 1초 전", secondsBeforeEnd: 1, isActive: true },
    { name: "끝나는 시각", secondsBeforeEnd: 0, isActive: false },
  ])("$name에는 활성 여부와 끝나는 시각을 정확히 준다", async ({ secondsBeforeEnd, isActive }) => {
    // Given
    const createdAt = CHEER_FIXTURE_NOW.subtract({ hours: 24 }).add({ seconds: secondsBeforeEnd });
    const useCase = createUseCase(new InMemoryCheerRepository([createCheerFixture({ createdAt })]));

    // When
    const cooldown = await useCase.execute(QUERY);

    // Then
    expect(cooldown).toEqual({
      isActive,
      remainingSeconds: secondsBeforeEnd,
      endsAt: isActive ? CHEER_FIXTURE_NOW.add({ seconds: secondsBeforeEnd }) : null,
    });
  });
});
