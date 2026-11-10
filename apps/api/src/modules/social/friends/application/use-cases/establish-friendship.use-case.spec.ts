import { INVITE_FRIENDSHIP, REDEEM_OUTCOME } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { FakeFollowCache } from "#test/doubles/social/fake-follow-cache";
import { InMemoryFollowRepository } from "#test/doubles/social/in-memory-follow.repository";
import { InMemoryFriendProfileReader } from "#test/doubles/social/in-memory-friend-profile.reader";
import { RecordingFollowNotifier } from "#test/doubles/social/recording-follow-notifier";
import { StubFriendLimitReader } from "#test/doubles/social/stub-friend-limit-reader";
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
import { CheckFirstFriendMilestoneUseCase } from "./check-first-friend-milestone.use-case.js";
import { EstablishFriendshipUseCase } from "./establish-friendship.use-case.js";

const INVITEE = FRIENDSHIP_FIXTURE_USER_ID;
const INVITER = FRIENDSHIP_FIXTURE_FRIEND_ID;
const OTHER = FRIENDSHIP_FIXTURE_OTHER_USER_ID;
const NOW = FRIENDSHIP_FIXTURE_NOW.add({ hours: 1 });

function setup(friendships: readonly Friendship[] = []) {
  const followRepository = new InMemoryFollowRepository(friendships);
  const profileReader = new InMemoryFriendProfileReader();
  profileReader.addUser({ id: INVITEE, userTag: "INVT0001", name: "초대받은 사람" });
  profileReader.addUser({ id: INVITER, userTag: "INVR0002" });
  const limitReader = new StubFriendLimitReader();
  const afterCommit = new RecordingAfterCommitRegistry();
  const cache = new FakeFollowCache();
  const notifier = new RecordingFollowNotifier();
  const mutationLock = new RecordingMutationLock();
  const logger = new SilentLogger();
  const useCase = new EstablishFriendshipUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock,
    afterCommit,
    followRepository,
    profileReader,
    limitReader,
    cache,
    notifier,
    checkFirstFriendMilestone: new CheckFirstFriendMilestoneUseCase({
      followRepository,
      notifier,
      logger,
    }),
    clock: new FixedClock(NOW),
    logger,
  });
  return { useCase, followRepository, limitReader, afterCommit, cache, notifier, mutationLock };
}

async function find(
  followRepository: InMemoryFollowRepository,
  followerId: string,
  followingId: string,
): Promise<Friendship | null> {
  return followRepository.findByFollowerAndFollowing(
    UserId.reconstitute(followerId),
    UserId.reconstitute(followingId),
  );
}

describe("EstablishFriendshipUseCase — 초대로 바로 친구 맺기", () => {
  it("이미 친구면 바꾸지 않고 ALREADY_FRIENDS를 준다", async () => {
    // Given
    const { useCase, followRepository, afterCommit } = setup(
      createMutualFriendshipFixtures({ userId: INVITEE, friendId: INVITER }),
    );

    // When
    const outcome = await useCase.execute({
      requesterId: INVITEE,
      targetUserId: INVITER,
      shouldNotifyFriends: true,
    });

    // Then
    expect(outcome).toBe(REDEEM_OUTCOME.ALREADY_FRIENDS);
    expect(followRepository.size).toBe(2);
    expect(afterCommit.tasks).toEqual([]);
  });

  it("요청한 사람 자리가 꽉 차면 아무것도 만들지 않고 UNAVAILABLE을 준다", async () => {
    // Given
    const { useCase, followRepository, limitReader, afterCommit } = setup(
      createMutualFriendshipFixtures({ userId: INVITEE, friendId: OTHER }),
    );
    limitReader.setMaxFriendCount(INVITEE, 1);
    limitReader.setMaxFriendCount(INVITER, 0);

    // When
    const outcome = await useCase.execute({
      requesterId: INVITEE,
      targetUserId: INVITER,
      shouldNotifyFriends: true,
    });

    // Then
    expect(outcome).toBe("UNAVAILABLE");
    expect(followRepository.size).toBe(2);
    expect(afterCommit.tasks).toEqual([]);
  });

  it("상대 자리가 꽉 차면 친구 요청만 보내고 커밋 뒤 요청 알림을 보낸다", async () => {
    // Given
    const { useCase, followRepository, limitReader, afterCommit, notifier } = setup();
    limitReader.setMaxFriendCount(INVITER, 0);

    // When
    const outcome = await useCase.execute({
      requesterId: INVITEE,
      targetUserId: INVITER,
      shouldNotifyFriends: false,
    });
    const notifiedBeforeCommit = [...notifier.newRequests];
    await afterCommit.runAll();

    // Then
    expect(outcome).toBe(INVITE_FRIENDSHIP.REQUESTED);
    expect((await find(followRepository, INVITEE, INVITER))?.toPrimitives()).toMatchObject({
      status: "PENDING",
      createdAt: NOW,
    });
    expect(notifiedBeforeCommit).toEqual([]);
    expect(notifier.newRequests).toEqual([
      { followerId: INVITEE, followingId: INVITER, followerName: "초대받은 사람" },
    ]);
  });

  it("상대 자리가 꽉 찼는데 이미 보낸 요청이 있으면 새로 만들거나 알리지 않는다", async () => {
    // Given
    const { useCase, followRepository, limitReader, afterCommit } = setup([
      createFriendshipFixture({ followerId: INVITEE, followingId: INVITER }),
    ]);
    limitReader.setMaxFriendCount(INVITER, 0);

    // When
    const outcome = await useCase.execute({
      requesterId: INVITEE,
      targetUserId: INVITER,
      shouldNotifyFriends: true,
    });

    // Then
    expect(outcome).toBe(INVITE_FRIENDSHIP.REQUESTED);
    expect(followRepository.size).toBe(1);
    expect(afterCommit.tasks).toEqual([]);
  });

  it("상대의 대기 요청을 수락하고 내 방향을 만들어 각자 목록 맨 뒤에 두며 커밋 뒤 캐시를 비우고 상대에게 알린다", async () => {
    // Given
    const { useCase, followRepository, afterCommit, cache, notifier, mutationLock } = setup([
      createFriendshipFixture({ followerId: INVITER, followingId: INVITEE }),
      ...createMutualFriendshipFixtures({ userId: INVITER, friendId: OTHER, userSortOrder: 3 }),
    ]);
    cache.friendCounts.set(INVITER, 1);

    // When
    const outcome = await useCase.execute({
      requesterId: INVITEE,
      targetUserId: INVITER,
      shouldNotifyFriends: true,
    });
    const notifiedBeforeCommit = [...notifier.mutual];
    await afterCommit.runAll();

    // Then
    expect(outcome).toBe(INVITE_FRIENDSHIP.FRIENDS);
    expect((await find(followRepository, INVITEE, INVITER))?.toPrimitives()).toMatchObject({
      status: "ACCEPTED",
      sortOrder: 0,
      updatedAt: NOW,
    });
    expect((await find(followRepository, INVITER, INVITEE))?.toPrimitives()).toMatchObject({
      status: "ACCEPTED",
      sortOrder: 4,
      updatedAt: NOW,
    });
    expect(notifiedBeforeCommit).toEqual([]);
    expect(cache.friendCounts.has(INVITER)).toBe(false);
    expect(notifier.mutual).toEqual([
      { userId: INVITER, friendId: INVITEE, friendName: "초대받은 사람" },
    ]);
    expect(notifier.milestones).toEqual([{ userId: INVITEE }]);
    expect(mutationLock.acquiredKeys).toEqual([
      [
        FriendLockKeys.pair(UserId.reconstitute(INVITEE), UserId.reconstitute(INVITER)),
        FriendLockKeys.list(UserId.reconstitute(INVITEE)),
        FriendLockKeys.list(UserId.reconstitute(INVITER)),
      ],
    ]);
  });

  it("초대처럼 호출자가 따로 알리면 친구 성립 알림은 빼고 이미 수락한 방향의 순서는 둔다", async () => {
    // Given
    const { useCase, followRepository, afterCommit, notifier } = setup([
      createFriendshipFixture({
        followerId: INVITEE,
        followingId: INVITER,
        status: "ACCEPTED",
        sortOrder: 7,
      }),
    ]);

    // When
    await useCase.execute({
      requesterId: INVITEE,
      targetUserId: INVITER,
      shouldNotifyFriends: false,
    });
    await afterCommit.runAll();

    // Then
    expect((await find(followRepository, INVITEE, INVITER))?.sortOrder).toBe(7);
    expect((await find(followRepository, INVITER, INVITEE))?.toPrimitives()).toMatchObject({
      status: "ACCEPTED",
      sortOrder: 0,
    });
    expect(notifier.mutual).toEqual([]);
    expect(notifier.milestones).toEqual([{ userId: INVITEE }, { userId: INVITER }]);
  });
});
