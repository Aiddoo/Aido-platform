import { SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";
import { createSocialInteractionFixture } from "#test/fixtures/social-interactions.fixture";

import { MarkManyCheersRead } from "./mark-many-cheers-read.use-case.js";

describe("응원 일괄 읽음 처리", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("수신자 소유의 미읽음만 한 번 갱신하고 중복 ID나 타인 소유는 개수에 포함하지 않는다", async () => {
    // Given
    const fixture = createSocialInteractionFixture();
    const unread = fixture.cheerRepository.seed({ senderId: "sender", receiverId: "receiver" });
    const read = fixture.cheerRepository.seed({
      senderId: "sender",
      receiverId: "receiver",
      readAt: new Date(SOCIAL_TIME.getTime() - 10000),
    });
    const other = fixture.cheerRepository.seed({ senderId: "sender", receiverId: "other" });
    const useCase = new MarkManyCheersRead(fixture);
    // When
    const count = await useCase.execute({
      userId: "receiver",
      cheerIds: [unread.id, unread.id, read.id, other.id, 99999],
    });
    // Then
    expect(count).toBe(1);
    expect(fixture.cheerRepository.records.get(unread.id)?.readAt).toEqual(SOCIAL_TIME);
    expect(fixture.cheerRepository.records.get(read.id)?.readAt).toEqual(read.readAt);
    expect(fixture.cheerRepository.records.get(other.id)?.readAt).toBeNull();
    expect(
      await useCase.execute({ userId: "receiver", cheerIds: [unread.id, read.id, other.id] }),
    ).toBe(0);
    expect(await useCase.execute({ userId: "receiver", cheerIds: [] })).toBe(0);
  });
});
