import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryFollowRepository } from "#test/doubles/social/in-memory-follow.repository";
import { InMemoryFriendProfileReader } from "#test/doubles/social/in-memory-friend-profile.reader";
import { InMemoryFriendshipReader } from "#test/doubles/social/in-memory-friendship.reader";
import {
  createMutualFriendshipFixtures,
  FRIENDSHIP_FIXTURE_NOW,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

import type { Friendship } from "../../domain/friendship.aggregate.js";
import { FriendLockKeys } from "../friends.lock-keys.js";
import { ReorderFriendUseCase } from "./reorder-friend.use-case.js";

const ME = FRIENDSHIP_FIXTURE_USER_ID;
const FRIEND_IDS = [
  "cfriend000000000000000001",
  "cfriend000000000000000002",
  "cfriend000000000000000003",
] as const;
const NOW = FRIENDSHIP_FIXTURE_NOW.add({ hours: 1 });

function setup() {
  const pairs = FRIEND_IDS.map((friendId, index) =>
    createMutualFriendshipFixtures({
      userId: ME,
      friendId,
      userSortOrder: index,
      friendSortOrder: index,
    }),
  );
  const mine = pairs.map(([friendship]) => friendship);
  const followRepository = new InMemoryFollowRepository(pairs.flat());
  const profileReader = new InMemoryFriendProfileReader();
  FRIEND_IDS.forEach((friendId, index) => {
    profileReader.addUser({ id: friendId, userTag: `FRND000${index}` });
  });
  const mutationLock = new RecordingMutationLock();
  const useCase = new ReorderFriendUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock,
    followRepository,
    friendshipReader: new InMemoryFriendshipReader(followRepository, profileReader),
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
  });
  return { useCase, followRepository, mutationLock, mine };
}

async function readSortOrders(
  followRepository: InMemoryFollowRepository,
  friendships: readonly Friendship[],
): Promise<(number | undefined)[]> {
  const sortOrders = [];
  for (const friendship of friendships) {
    const found = await followRepository.findByFollowerAndFollowing(
      friendship.followerId,
      friendship.followingId,
    );
    sortOrders.push(found?.sortOrder);
  }
  return sortOrders;
}

describe("ReorderFriendUseCase — 친구 목록 순서 변경", () => {
  it.each([
    { name: "남의 관계", userId: FRIEND_IDS[0], target: undefined, missingId: "mine" },
    { name: "없는 기준 관계", userId: ME, target: "missing", missingId: "missing" },
  ])("$name이면 FOLLOW_0910으로 거절하고 순서를 둔다", async ({ userId, target, missingId }) => {
    // Given
    const { useCase, followRepository, mine } = setup();
    const [first] = mine;
    const before = followRepository.listAll().map((friendship) => friendship.toPrimitives());

    // When
    const result = useCase.execute({
      userId,
      friendshipId: first?.id.value ?? "",
      targetFriendshipId: target,
      position: "before",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.FOLLOW_0910,
      details: { targetFollowId: missingId === "mine" ? first?.id.value : missingId },
    });
    expect(followRepository.listAll().map((friendship) => friendship.toPrimitives())).toEqual(
      before,
    );
  });

  it("자기 자신을 기준으로 옮기면 쓰지 않고 지금 친구를 돌려준다", async () => {
    // Given
    const { useCase, followRepository, mine } = setup();
    const [first] = mine;
    const before = followRepository.listAll().map((friendship) => friendship.toPrimitives());

    // When
    const friend = await useCase.execute({
      userId: ME,
      friendshipId: first?.id.value ?? "",
      targetFriendshipId: first?.id.value,
      position: "after",
    });

    // Then
    expect(friend).toMatchObject({
      friendshipId: first?.id.value,
      friendsSince: FRIENDSHIP_FIXTURE_NOW,
    });
    expect(followRepository.listAll().map((friendship) => friendship.toPrimitives())).toEqual(
      before,
    );
  });

  it.each([
    {
      name: "세 번째를 첫 번째 앞으로",
      source: 2,
      target: 0,
      position: "before",
      expected: [1, 2, 0],
    },
    {
      name: "첫 번째를 맨 뒤로",
      source: 0,
      target: undefined,
      position: "after",
      expected: [2, 0, 1],
    },
    {
      name: "세 번째를 맨 앞으로",
      source: 2,
      target: undefined,
      position: "before",
      expected: [1, 2, 0],
    },
  ] as const)(
    "$name 옮기면 내 목록 구간만 다시 매긴다",
    async ({ source, target, position, expected }) => {
      // Given
      const { useCase, followRepository, mutationLock, mine } = setup();
      const moving = mine[source];
      const targetFriendship = target == null ? undefined : mine[target];

      // When
      const friend = await useCase.execute({
        userId: ME,
        friendshipId: moving?.id.value ?? "",
        targetFriendshipId: targetFriendship?.id.value,
        position,
      });

      // Then
      expect(await readSortOrders(followRepository, mine)).toEqual(expected);
      expect(
        followRepository
          .listAll()
          .filter((friendship) => !friendship.followerId.equals(UserId.reconstitute(ME)))
          .map((friendship) => friendship.sortOrder),
      ).toEqual([0, 1, 2]);
      expect(friend).toMatchObject({ friendshipId: moving?.id.value, friendsSince: NOW });
      expect(mutationLock.acquiredKeys).toEqual([[FriendLockKeys.list(UserId.reconstitute(ME))]]);
    },
  );
});
