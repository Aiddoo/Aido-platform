import { SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";
import { createSocialInteractionFixture } from "#test/fixtures/social-interactions.fixture";

import { GetReceivedCheers } from "./get-received-cheers.use-case.js";

describe("받은 응원 목록 조회", () => {
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
      fixture.cheerRepository.seed({
        senderId: "sender",
        receiverId: "receiver",
        readAt: index === 0 ? SOCIAL_TIME : null,
      });
    // When
    const result = await new GetReceivedCheers(fixture).execute({ userId: "receiver", size: 2 });
    // Then
    expect(result).toMatchObject({ totalCount: 3, unreadCount: 2, hasMore: true });
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.sender.profile === null)).toBe(true);
  });
  it("다른 사용자의 기록은 내 빈 목록이나 개수에 포함하지 않는다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    fixture.cheerRepository.seed({ senderId: "sender", receiverId: "receiver" });
    // When
    const result = await new GetReceivedCheers(fixture).execute({ userId: "other" });
    // Then
    expect(result).toEqual({ items: [], totalCount: 0, unreadCount: 0, hasMore: false });
  });
});
