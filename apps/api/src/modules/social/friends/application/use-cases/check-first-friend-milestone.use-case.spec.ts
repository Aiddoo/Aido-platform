import { InMemoryFollowRepository } from "#test/doubles/social/in-memory-follow.repository";
import { RecordingFollowNotifier } from "#test/doubles/social/recording-follow-notifier";
import {
  createMutualFriendshipFixtures,
  FRIENDSHIP_FIXTURE_FRIEND_ID,
  FRIENDSHIP_FIXTURE_OTHER_USER_ID,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

import { CheckFirstFriendMilestoneUseCase } from "./check-first-friend-milestone.use-case.js";

describe("CheckFirstFriendMilestoneUseCase — 첫 친구 마일스톤", () => {
  it("친구가 정확히 한 명인 사람에게만 첫 친구 알림을 보낸다", async () => {
    // Given
    const followRepository = new InMemoryFollowRepository([
      ...createMutualFriendshipFixtures({
        userId: FRIENDSHIP_FIXTURE_USER_ID,
        friendId: FRIENDSHIP_FIXTURE_FRIEND_ID,
      }),
      ...createMutualFriendshipFixtures({
        userId: FRIENDSHIP_FIXTURE_FRIEND_ID,
        friendId: FRIENDSHIP_FIXTURE_OTHER_USER_ID,
      }),
    ]);
    const notifier = new RecordingFollowNotifier();
    const useCase = new CheckFirstFriendMilestoneUseCase({
      followRepository,
      notifier,
    });

    // When
    await useCase.execute({
      userIds: [FRIENDSHIP_FIXTURE_USER_ID, FRIENDSHIP_FIXTURE_FRIEND_ID],
    });

    // Then
    expect(notifier.milestones).toEqual([{ userId: FRIENDSHIP_FIXTURE_USER_ID }]);
  });

  it("친구 수를 세지 못하면 오류를 던져 친구 관계 저장과 함께 되돌린다", async () => {
    // Given
    const notifier = new RecordingFollowNotifier();
    const useCase = new CheckFirstFriendMilestoneUseCase({
      followRepository: {
        countMutualFriends: async () => {
          throw new TypeError("connection reset");
        },
      },
      notifier,
    });

    // When
    const result = useCase.execute({ userIds: [FRIENDSHIP_FIXTURE_USER_ID] });

    // Then
    await expect(result).rejects.toThrow(TypeError);
    expect(notifier.milestones).toEqual([]);
  });
});
