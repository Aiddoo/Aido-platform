import { ErrorCode } from "@aido/api/errors";

import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { FakeFriendshipCache } from "#test/doubles/social/fake-friendship-cache";
import { InMemoryFriendProfileReader } from "#test/doubles/social/in-memory-friend-profile.reader";
import { InMemoryFriendReader } from "#test/doubles/social/in-memory-friend.reader";
import { InMemoryFriendshipRepository } from "#test/doubles/social/in-memory-friendship.repository";
import { RecordingFriendshipNotifier } from "#test/doubles/social/recording-friendship-notifier";
import {
  createFriendshipFixture,
  createMutualFriendshipFixtures,
  FRIENDSHIP_FIXTURE_FRIEND_ID,
  FRIENDSHIP_FIXTURE_NOW,
  FRIENDSHIP_FIXTURE_OTHER_USER_ID,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

import type { Friendship } from "../../domain/friendship.aggregate.js";
import { AcceptFriendRequestUseCase } from "./accept-friend-request.use-case.js";
import { NotifyFirstFriendMilestoneUseCase } from "./notify-first-friend-milestone.use-case.js";

const ME = FRIENDSHIP_FIXTURE_USER_ID;
const REQUESTER = FRIENDSHIP_FIXTURE_FRIEND_ID;
const EXISTING_FRIEND = FRIENDSHIP_FIXTURE_OTHER_USER_ID;
const NOW = FRIENDSHIP_FIXTURE_NOW.add({ hours: 1 });

// 작업은 바로 돌리되 release 전까지 "커밋"을 미뤄 커밋 뒤 작업 순서를 볼 수 있게 한다
class GatedUnitOfWork extends UnitOfWorkPort {
  readonly entered = Promise.withResolvers<void>();
  readonly released = Promise.withResolvers<void>();

  async run<T>(work: () => Promise<T>): Promise<T> {
    const result = await work();
    this.entered.resolve();
    await this.released.promise;
    return result;
  }
}

function setup(
  friendships: readonly Friendship[],
  options: { unitOfWork?: UnitOfWorkPort; hasRequesterProfile?: boolean } = {},
) {
  const friendshipRepository = new InMemoryFriendshipRepository(friendships);
  const profileReader = new InMemoryFriendProfileReader();
  profileReader.addUser({ id: ME, userTag: "MEME0001", name: "나" });
  profileReader.addUser({ id: EXISTING_FRIEND, userTag: "OTHR0003" });
  if (options.hasRequesterProfile !== false) {
    profileReader.addUser({ id: REQUESTER, userTag: "FRND0002", profileImage: "avatar.png" });
  }
  const cache = new FakeFriendshipCache();
  const notifier = new RecordingFriendshipNotifier();
  const logger = new SilentLogger();
  const useCase = new AcceptFriendRequestUseCase({
    unitOfWork: options.unitOfWork ?? new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    friendshipRepository,
    friendReader: new InMemoryFriendReader(friendshipRepository, profileReader),
    profileReader,
    cache,
    notifier,
    notifyFirstFriendMilestone: new NotifyFirstFriendMilestoneUseCase({
      friendshipRepository,
      notifier,
    }),
    clock: new FixedClock(NOW),
    logger,
  });
  return { useCase, friendshipRepository, cache, notifier };
}

describe("AcceptFriendRequestUseCase — 친구 요청 수락", () => {
  it.each([
    { name: "받은 요청이 없으면", friendships: [] },
    {
      name: "이미 친구면",
      friendships: createMutualFriendshipFixtures({ userId: ME, friendId: REQUESTER }),
    },
  ])("$name FOLLOW_0903으로 거절하고 관계·알림을 그대로 둔다", async ({ friendships }) => {
    // Given
    const { useCase, friendshipRepository, notifier } = setup(friendships);
    const before = friendshipRepository.listAll().map((friendship) => friendship.toPrimitives());

    // When
    const result = useCase.execute({ userId: ME, requesterUserId: REQUESTER });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.FOLLOW_0903,
      details: { targetUserId: REQUESTER },
    });
    expect(friendshipRepository.listAll().map((friendship) => friendship.toPrimitives())).toEqual(
      before,
    );
    expect(notifier.mutual).toEqual([]);
  });

  it.each([false, true])(
    "내 쪽 대기 요청 있음=%s이어도 두 방향을 각자 목록 맨 뒤에 수락하고 요청한 사람에게만 알린다",
    async (hasMyRequest) => {
      // Given
      const { useCase, friendshipRepository, notifier } = setup([
        ...createMutualFriendshipFixtures({
          userId: ME,
          friendId: EXISTING_FRIEND,
          userSortOrder: 2,
        }),
        createFriendshipFixture({ followerId: REQUESTER, followingId: ME }),
        ...(hasMyRequest
          ? [createFriendshipFixture({ followerId: ME, followingId: REQUESTER })]
          : []),
      ]);

      // When
      const friend = await useCase.execute({ userId: ME, requesterUserId: REQUESTER });

      // Then
      const [mine, theirs] = await Promise.all([
        friendshipRepository.findByFollowerAndFollowing(
          UserId.reconstitute(ME),
          UserId.reconstitute(REQUESTER),
        ),
        friendshipRepository.findByFollowerAndFollowing(
          UserId.reconstitute(REQUESTER),
          UserId.reconstitute(ME),
        ),
      ]);
      expect(mine?.toPrimitives()).toMatchObject({
        status: "ACCEPTED",
        sortOrder: 3,
        updatedAt: NOW,
      });
      expect(theirs?.toPrimitives()).toMatchObject({
        status: "ACCEPTED",
        sortOrder: 0,
        updatedAt: NOW,
      });
      expect(friend).toEqual({
        friendshipId: mine?.id.value,
        user: { id: REQUESTER, userTag: "FRND0002", name: null, profileImage: "avatar.png" },
        friendsSince: NOW,
      });
      // 수락한 사람은 화면에서 결과를 봤으므로 요청한 사람에게만 알린다
      expect(notifier.mutual).toEqual([{ userId: REQUESTER, friendId: ME, friendName: "나" }]);
      expect(notifier.milestones).toEqual([{ userId: REQUESTER }]);
    },
  );

  it("알림 작업은 수락과 같은 트랜잭션에 넣고 친구 캐시는 커밋 뒤에 비운다", async () => {
    // Given
    const unitOfWork = new GatedUnitOfWork();
    const { useCase, cache, notifier } = setup(
      [createFriendshipFixture({ followerId: REQUESTER, followingId: ME })],
      { unitOfWork },
    );
    cache.friendCounts.set(ME, 0);

    // When
    const execution = useCase.execute({ userId: ME, requesterUserId: REQUESTER });
    await unitOfWork.entered.promise;
    const beforeCommit = { friendCount: cache.friendCounts.get(ME), mutual: [...notifier.mutual] };
    unitOfWork.released.resolve();
    await execution;

    // Then
    expect(beforeCommit).toEqual({ friendCount: 0, mutual: [expect.anything()] });
    expect(cache.friendCounts.has(ME)).toBe(false);
    expect(notifier.mutual).toHaveLength(1);
  });

  it("수락한 관계의 상대 요약을 읽지 못하면 SYS_0001을 내고 알리지 않는다", async () => {
    // Given
    const { useCase, notifier } = setup(
      [createFriendshipFixture({ followerId: REQUESTER, followingId: ME })],
      { hasRequesterProfile: false },
    );

    // When
    const result = useCase.execute({ userId: ME, requesterUserId: REQUESTER });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0001 });
    expect(notifier.mutual).toEqual([]);
  });
});
