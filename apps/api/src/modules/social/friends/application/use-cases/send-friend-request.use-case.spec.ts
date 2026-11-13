import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { FakeFriendshipCache } from "#test/doubles/social/fake-friendship-cache";
import { InMemoryFriendProfileReader } from "#test/doubles/social/in-memory-friend-profile.reader";
import { InMemoryFriendshipRepository } from "#test/doubles/social/in-memory-friendship.repository";
import { RecordingFriendshipNotifier } from "#test/doubles/social/recording-friendship-notifier";
import { StubFriendLimitReader } from "#test/doubles/social/stub-friend-limit-reader";
import { StubUserBlockReader } from "#test/doubles/social/stub-user-block-reader";
import {
  createFriendshipFixture,
  createMutualFriendshipFixtures,
  FRIENDSHIP_FIXTURE_FRIEND_ID,
  FRIENDSHIP_FIXTURE_NOW,
  FRIENDSHIP_FIXTURE_OTHER_USER_ID,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

import type { Friendship } from "../../domain/friendship.aggregate.js";
import { FriendLockKeys } from "../friends.lock-keys.js";
import { NotifyFirstFriendMilestoneUseCase } from "./notify-first-friend-milestone.use-case.js";
import { SendFriendRequestUseCase } from "./send-friend-request.use-case.js";

const ME = FRIENDSHIP_FIXTURE_USER_ID;
const FRIEND = FRIENDSHIP_FIXTURE_FRIEND_ID;
const OTHER = FRIENDSHIP_FIXTURE_OTHER_USER_ID;
const NOW = FRIENDSHIP_FIXTURE_NOW.add({ hours: 1 });

function setup(friendships: readonly Friendship[] = []) {
  const friendshipRepository = new InMemoryFriendshipRepository(friendships);
  const profileReader = new InMemoryFriendProfileReader();
  profileReader.addUser({ id: ME, userTag: "MEME0001" });
  profileReader.addUser({ id: FRIEND, userTag: "FRND0002", name: "친구" });
  profileReader.addUser({ id: OTHER, userTag: "OTHR0003", name: "다른 사람" });
  const limitReader = new StubFriendLimitReader();
  const blockReader = new StubUserBlockReader();
  const cache = new FakeFriendshipCache();
  const notifier = new RecordingFriendshipNotifier();
  const mutationLock = new RecordingMutationLock();
  const logger = new SilentLogger();
  const useCase = new SendFriendRequestUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock,
    friendshipRepository,
    profileReader,
    limitReader,
    blockReader,
    cache,
    notifier,
    notifyFirstFriendMilestone: new NotifyFirstFriendMilestoneUseCase({
      friendshipRepository,
      notifier,
    }),
    clock: new FixedClock(NOW),
    logger,
  });
  return {
    useCase,
    friendshipRepository,
    profileReader,
    limitReader,
    blockReader,
    cache,
    notifier,
    mutationLock,
  };
}

describe("SendFriendRequestUseCase — 친구 요청 보내기", () => {
  it.each([
    {
      name: "자기 자신",
      targetUserId: ME,
      seeds: [],
      code: ErrorCode.FOLLOW_0904,
      details: undefined,
    },
    {
      name: "없는 사용자",
      targetUserId: "missing",
      seeds: [],
      code: ErrorCode.FOLLOW_0905,
      details: { targetUserId: "missing" },
    },
    {
      name: "이미 보낸 요청",
      targetUserId: FRIEND,
      seeds: [createFriendshipFixture({ followerId: ME, followingId: FRIEND })],
      code: ErrorCode.FOLLOW_0901,
      details: { targetUserId: FRIEND },
    },
    {
      name: "이미 친구인 관계",
      targetUserId: FRIEND,
      seeds: createMutualFriendshipFixtures({ userId: ME, friendId: FRIEND }),
      code: ErrorCode.FOLLOW_0902,
      details: { targetUserId: FRIEND },
    },
    {
      name: "상대만 나를 수락해 둔 관계",
      targetUserId: FRIEND,
      seeds: [createFriendshipFixture({ followerId: FRIEND, followingId: ME, status: "ACCEPTED" })],
      code: ErrorCode.FOLLOW_0902,
      details: { targetUserId: FRIEND },
    },
  ])(
    "$name에게 보내면 $code로 거절하고 관계·알림을 두지 않는다",
    async ({ targetUserId, seeds, code, details }) => {
      // Given
      const { useCase, friendshipRepository, notifier } = setup(seeds);
      const before = friendshipRepository.listAll().map((friendship) => friendship.toPrimitives());

      // When
      const result = useCase.execute({ userId: ME, targetUserId });

      // Then
      await expect(result).rejects.toMatchObject({ errorCode: code, details });
      expect(friendshipRepository.listAll().map((friendship) => friendship.toPrimitives())).toEqual(
        before,
      );
      expect(notifier.newRequests).toEqual([]);
      expect(notifier.mutual).toEqual([]);
    },
  );

  it("내가 차단한 사람에게는 BLOCK_2203, 나를 차단한 사람에게는 없는 사용자 오류로 답한다", async () => {
    // Given
    const { useCase, blockReader, friendshipRepository } = setup();
    blockReader.block(ME, FRIEND);
    blockReader.block(OTHER, ME);

    // When
    const [blocking, blockedBy] = await Promise.allSettled([
      useCase.execute({ userId: ME, targetUserId: FRIEND }),
      useCase.execute({ userId: ME, targetUserId: OTHER }),
    ]);

    // Then
    expect(blocking).toMatchObject({
      status: "rejected",
      reason: { errorCode: ErrorCode.BLOCK_2203, details: { targetUserId: FRIEND } },
    });
    expect(blockedBy).toMatchObject({
      status: "rejected",
      reason: { errorCode: ErrorCode.FOLLOW_0905, details: { targetUserId: OTHER } },
    });
    expect(friendshipRepository.size).toBe(0);
  });

  it("친구 한도에 닿으면 대상이 없어도 한도 오류 FOLLOW_0909를 먼저 준다", async () => {
    // Given
    const { useCase, limitReader, friendshipRepository } = setup(
      createMutualFriendshipFixtures({ userId: ME, friendId: FRIEND }),
    );
    limitReader.setMaxFriendCount(ME, 1);

    // When
    const result = useCase.execute({ userId: ME, targetUserId: "missing" });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.FOLLOW_0909,
      details: {
        current: 1,
        limit: 1,
        charged: false,
        featureQuota: { feature: "FRIEND", userId: ME, limit: 1, used: 1 },
      },
    });
    expect(friendshipRepository.size).toBe(2);
  });

  it("새 요청은 대기 관계로 저장하고 프로필 이름이 없는 보낸 사람은 태그로 알린다", async () => {
    // Given
    const { useCase, friendshipRepository, notifier, mutationLock } = setup();

    // When
    const result = await useCase.execute({ userId: ME, targetUserId: FRIEND });

    // Then
    expect(result.isAutoAccepted).toBe(false);
    expect(result.friendship.toPrimitives()).toMatchObject({
      followerId: ME,
      followingId: FRIEND,
      status: "PENDING",
      sortOrder: 0,
      createdAt: NOW,
    });
    expect(
      (
        await friendshipRepository.findByFollowerAndFollowing(
          UserId.reconstitute(ME),
          UserId.reconstitute(FRIEND),
        )
      )?.toPrimitives(),
    ).toEqual(result.friendship.toPrimitives());
    expect(notifier.newRequests).toEqual([
      { followerId: ME, followingId: FRIEND, followerName: "MEME0001" },
    ]);
    expect(mutationLock.acquiredKeys).toEqual([
      [
        FriendLockKeys.pair(UserId.reconstitute(ME), UserId.reconstitute(FRIEND)),
        FriendLockKeys.list(UserId.reconstitute(ME)),
        FriendLockKeys.list(UserId.reconstitute(FRIEND)),
      ],
    ]);
  });

  it("상대가 먼저 보낸 요청이 있으면 두 방향을 각자 목록 맨 뒤에 수락하고 친구 캐시를 비운다", async () => {
    // Given
    const { useCase, friendshipRepository, cache, notifier } = setup([
      createFriendshipFixture({ followerId: FRIEND, followingId: ME }),
      ...createMutualFriendshipFixtures({ userId: FRIEND, friendId: OTHER, userSortOrder: 4 }),
    ]);
    cache.friendCounts.set(ME, 0);
    cache.friendIds.set(FRIEND, [OTHER]);

    // When
    const result = await useCase.execute({ userId: ME, targetUserId: FRIEND });

    // Then
    expect(result.isAutoAccepted).toBe(true);
    const [mine, theirs] = await Promise.all([
      friendshipRepository.findByFollowerAndFollowing(
        UserId.reconstitute(ME),
        UserId.reconstitute(FRIEND),
      ),
      friendshipRepository.findByFollowerAndFollowing(
        UserId.reconstitute(FRIEND),
        UserId.reconstitute(ME),
      ),
    ]);
    expect(mine?.toPrimitives()).toMatchObject({
      status: "ACCEPTED",
      sortOrder: 0,
      updatedAt: NOW,
    });
    expect(theirs?.toPrimitives()).toMatchObject({
      status: "ACCEPTED",
      sortOrder: 5,
      updatedAt: NOW,
    });
    expect(cache.friendCounts.has(ME)).toBe(false);
    expect(cache.friendIds.has(FRIEND)).toBe(false);
    // 요청을 보내 친구가 된 사람은 화면에서 결과를 봤으므로 먼저 요청했던 상대에게만 알린다
    expect(notifier.mutual).toEqual([{ userId: FRIEND, friendId: ME, friendName: "MEME0001" }]);
    expect(notifier.milestones).toEqual([{ userId: ME }]);
    expect(notifier.newRequests).toEqual([]);
  });
});
