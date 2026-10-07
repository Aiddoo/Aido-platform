import { SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";
import { createSocialInteractionFixture } from "#test/fixtures/social-interactions.fixture";

import { GetCheerLimit } from "./get-cheer-limit.use-case.js";

describe("응원 일일 한도 조회", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { status: "FREE", remaining: 2, limit: 3 },
    { status: "ACTIVE", remaining: null, limit: null },
  ])("$status는 사용자 날짜의 시작을 포함하고 끝을 제외한 사용량을 반환한다", async (input) => {
    // Given
    const fixture = createSocialInteractionFixture();
    fixture.database.users.set("sender", { role: "USER", subscriptionStatus: input.status });
    for (const createdAt of [
      "2026-07-25T14:59:59.999Z",
      "2026-07-25T15:00:00.000Z",
      "2026-07-26T15:00:00.000Z",
    ])
      fixture.cheerRepository.seed({
        senderId: "sender",
        receiverId: "receiver",
        createdAt: new Date(createdAt),
      });
    fixture.cheerRepository.seed({ senderId: "other", receiverId: "receiver" });
    // When
    const result = await new GetCheerLimit(fixture).execute({
      userId: "sender",
      timezone: "Asia/Seoul",
    });
    // Then
    expect(result).toEqual({ dailyLimit: input.limit, used: 1, remaining: input.remaining });
  });
});
