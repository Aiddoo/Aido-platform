import { SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";
import { createSocialInteractionFixture } from "#test/fixtures/social-interactions.fixture";

import { GetSentNudges } from "./get-sent-nudges.use-case.js";

describe("보낸 콕 목록 조회", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("초과 항목을 잘라내면서 전체 개수와 프로필 null을 보존한다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    fixture.addUser("sender", null);
    for (let index = 0; index < 3; index += 1)
      fixture.nudgeRepository.seed({
        senderId: "sender",
        receiverId: "receiver",
        readAt: index === 0 ? SOCIAL_TIME : null,
        todoId: 1,
      });
    // When
    const result = await new GetSentNudges(fixture).execute({ userId: "sender", size: 2 });
    // Then
    expect(result).toMatchObject({ totalCount: 3, hasMore: true });
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.sender.profile === null)).toBe(true);
  });
  it("다른 사용자의 기록은 내 빈 목록이나 개수에 포함하지 않는다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    fixture.nudgeRepository.seed({ senderId: "sender", receiverId: "receiver", todoId: 1 });
    // When
    const result = await new GetSentNudges(fixture).execute({ userId: "other" });
    // Then
    expect(result).toEqual({ items: [], totalCount: 0, hasMore: false });
  });
});
