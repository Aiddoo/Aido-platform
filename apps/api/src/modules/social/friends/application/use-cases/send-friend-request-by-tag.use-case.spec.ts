import { createSocialFriendFixture, SOCIAL_TIME } from "#test/fixtures/social-friends.fixture";

import { SendFriendRequestByTag } from "./send-friend-request-by-tag.use-case.js";
import { SendFriendRequest } from "./send-friend-request.use-case.js";

describe("사용자 태그로 친구 요청", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SOCIAL_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { tag: "!", code: "SYS_0002" },
    { tag: "ZZZZZZZZ", code: "FOLLOW_0905" },
  ])(
    "$tag 태그가 유효하지 않거나 없으면 $code 오류로 거부하고 요청을 저장하지 않는다",
    async (input) => {
      // Given
      const fixture = createSocialFriendFixture();
      fixture.addUser("me");
      const useCase = new SendFriendRequestByTag({
        followRepository: fixture.followRepository,
        sendFriendRequest: new SendFriendRequest(fixture),
      });
      // When / Then
      await expect(
        useCase.execute({ userId: "me", targetUserTag: input.tag }),
      ).rejects.toMatchObject({ errorCode: input.code });
      expect(fixture.followRepository.follows.size).toBe(0);
    },
  );
  it("태그를 해석한 뒤 실제 요청 UseCase로 PENDING 관계를 저장한다", async () => {
    // Given
    const fixture = createSocialFriendFixture();
    fixture.addUser("me");
    const friend = fixture.addUser("friend");
    const useCase = new SendFriendRequestByTag({
      followRepository: fixture.followRepository,
      sendFriendRequest: new SendFriendRequest(fixture),
    });
    // When
    const result = await useCase.execute({ userId: "me", targetUserTag: friend.userTag });
    // Then
    expect(fixture.followRepository.follows.get(result.follow.id)).toMatchObject({
      followerId: "me",
      followingId: "friend",
      status: "PENDING",
    });
    expect(fixture.notifier.newRequests).toHaveLength(1);
  });
});
