import { ErrorCode } from "@aido/api/errors";

import { InMemoryFriendProfileReader } from "#test/doubles/social/in-memory-friend-profile.reader";
import {
  createFriendshipFixture,
  FRIENDSHIP_FIXTURE_FRIEND_ID,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

import { SendFriendRequestByTagUseCase } from "./send-friend-request-by-tag.use-case.js";
import type { SendFriendRequestCommand } from "./send-friend-request.use-case.js";

function setup() {
  const profileReader = new InMemoryFriendProfileReader();
  profileReader.addUser({ id: FRIENDSHIP_FIXTURE_FRIEND_ID, userTag: "FRND0002" });
  profileReader.addUser({ id: "inactive", userTag: "GONE0003", isActive: false });
  const requests: SendFriendRequestCommand[] = [];
  const useCase = new SendFriendRequestByTagUseCase({
    profileReader,
    sendFriendRequest: {
      // 태그 해석 뒤의 요청 흐름은 SendFriendRequestUseCase spec이 지킨다
      execute: async (command) => {
        requests.push(command);
        const friendship = createFriendshipFixture({
          followerId: command.userId,
          followingId: command.targetUserId,
        });
        return { friendship, isAutoAccepted: false };
      },
    },
  });
  return { useCase, requests };
}

describe("SendFriendRequestByTagUseCase — 태그로 친구 요청", () => {
  it.each([
    { tag: "!", code: ErrorCode.SYS_0002, details: { userTag: "!" } },
    { tag: "ZZZZZZZZ", code: ErrorCode.FOLLOW_0905, details: { userTag: "ZZZZZZZZ" } },
    { tag: "GONE0003", code: ErrorCode.FOLLOW_0905, details: { userTag: "GONE0003" } },
  ])(
    "$tag 태그가 형식이 틀리거나 활성 사용자가 없으면 $code로 거절한다",
    async ({ tag, code, details }) => {
      // Given
      const { useCase, requests } = setup();

      // When
      const result = useCase.execute({ userId: FRIENDSHIP_FIXTURE_USER_ID, targetUserTag: tag });

      // Then
      await expect(result).rejects.toMatchObject({ errorCode: code, details });
      expect(requests).toEqual([]);
    },
  );

  it("태그를 사용자 id로 바꿔 친구 요청을 보낸다", async () => {
    // Given
    const { useCase, requests } = setup();

    // When
    const result = await useCase.execute({
      userId: FRIENDSHIP_FIXTURE_USER_ID,
      targetUserTag: "FRND0002",
    });

    // Then
    expect(result.friendship.followingId.value).toBe(FRIENDSHIP_FIXTURE_FRIEND_ID);
    expect(requests).toEqual([
      { userId: FRIENDSHIP_FIXTURE_USER_ID, targetUserId: FRIENDSHIP_FIXTURE_FRIEND_ID },
    ]);
  });
});
