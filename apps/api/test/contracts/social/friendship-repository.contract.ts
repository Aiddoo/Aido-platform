import { ErrorCode } from "@aido/api/errors";

import type { FriendshipRepositoryPort } from "#api/modules/social/friends/application/ports/friendship.repository.port";
import type {
  Friendship,
  FriendshipPrimitives,
} from "#api/modules/social/friends/domain/friendship.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createFriendshipFixture,
  FRIENDSHIP_FIXTURE_FRIEND_ID,
  FRIENDSHIP_FIXTURE_NOW,
  FRIENDSHIP_FIXTURE_OTHER_USER_ID,
  FRIENDSHIP_FIXTURE_USER_ID,
} from "#test/fixtures/social/friendship.fixture";

const USER_ID = UserId.reconstitute(FRIENDSHIP_FIXTURE_USER_ID);
const FRIEND_ID = UserId.reconstitute(FRIENDSHIP_FIXTURE_FRIEND_ID);
const OTHER_USER_ID = UserId.reconstitute(FRIENDSHIP_FIXTURE_OTHER_USER_ID);
const LATER = FRIENDSHIP_FIXTURE_NOW.add({ minutes: 1 });

async function saveFriendship(
  repository: FriendshipRepositoryPort,
  overrides: Partial<FriendshipPrimitives> = {},
): Promise<Friendship> {
  const friendship = createFriendshipFixture(overrides);
  await repository.save(friendship);
  return friendship;
}

async function saveMutual(
  repository: FriendshipRepositoryPort,
  userId: string,
  friendId: string,
  userSortOrder = 0,
): Promise<Friendship> {
  const mine = await saveFriendship(repository, {
    followerId: userId,
    followingId: friendId,
    status: "ACCEPTED",
    sortOrder: userSortOrder,
  });
  await saveFriendship(repository, {
    followerId: friendId,
    followingId: userId,
    status: "ACCEPTED",
  });
  return mine;
}

export function describeFriendshipRepositoryContract(
  createRepository: () => Promise<FriendshipRepositoryPort>,
): void {
  describe("친구 관계 저장소 계약", () => {
    it("저장한 관계는 그 방향으로만 찾고 다시 저장하면 생성 시각을 두고 상태·순서·수정 시각을 덮어쓴다", async () => {
      // Given
      const repository = await createRepository();
      const request = await saveFriendship(repository);
      const accepted = createFriendshipFixture({
        ...request.toPrimitives(),
        status: "ACCEPTED",
        sortOrder: 3,
        updatedAt: LATER,
      });

      // When
      await repository.save(accepted);
      const found = await repository.findByFollowerAndFollowing(USER_ID, FRIEND_ID);
      const reverse = await repository.findByFollowerAndFollowing(FRIEND_ID, USER_ID);

      // Then
      expect(found?.toPrimitives()).toEqual(accepted.toPrimitives());
      expect(reverse).toBeNull();
    });

    it("같은 두 사람·방향의 다른 관계를 저장하면 FOLLOW_0901로 거절하고 처음 관계를 둔다", async () => {
      // Given
      const repository = await createRepository();
      const first = await saveFriendship(repository);
      const duplicate = createFriendshipFixture();

      // When
      const saving = repository.save(duplicate);

      // Then
      await expect(saving).rejects.toMatchObject({
        errorCode: ErrorCode.FOLLOW_0901,
        details: { targetUserId: FRIENDSHIP_FIXTURE_FRIEND_ID },
      });
      const found = await repository.findByFollowerAndFollowing(USER_ID, FRIEND_ID);
      expect(found?.id.equals(first.id)).toBe(true);
    });

    it("수락된 관계만 그 follower가 id로 찾는다", async () => {
      // Given
      const repository = await createRepository();
      const accepted = await saveFriendship(repository, { status: "ACCEPTED" });
      const pending = await saveFriendship(repository, {
        followingId: FRIENDSHIP_FIXTURE_OTHER_USER_ID,
      });

      // When
      const [owned, foreign, waiting] = await Promise.all([
        repository.findAcceptedByIdAndFollowerId(accepted.id, USER_ID),
        repository.findAcceptedByIdAndFollowerId(accepted.id, FRIEND_ID),
        repository.findAcceptedByIdAndFollowerId(pending.id, USER_ID),
      ]);

      // Then
      expect(owned?.id.equals(accepted.id)).toBe(true);
      expect(foreign).toBeNull();
      expect(waiting).toBeNull();
    });

    it("친구 목록 최대 순서는 그 follower의 수락된 관계만 보고 없으면 null이다", async () => {
      // Given
      const repository = await createRepository();
      await saveFriendship(repository, { status: "ACCEPTED", sortOrder: 2 });
      await saveFriendship(repository, {
        followingId: FRIENDSHIP_FIXTURE_OTHER_USER_ID,
        sortOrder: 9,
      });
      await saveFriendship(repository, {
        followerId: FRIENDSHIP_FIXTURE_FRIEND_ID,
        followingId: FRIENDSHIP_FIXTURE_OTHER_USER_ID,
        status: "ACCEPTED",
        sortOrder: 7,
      });

      // When
      const [mine, none] = await Promise.all([
        repository.findMaxFriendSortOrder(USER_ID),
        repository.findMaxFriendSortOrder(OTHER_USER_ID),
      ]);

      // Then
      expect(mine).toBe(2);
      expect(none).toBeNull();
    });

    it("두 방향이 모두 수락된 상대만 맞팔 친구로 세고 판정한다", async () => {
      // Given
      const repository = await createRepository();
      await saveMutual(repository, FRIENDSHIP_FIXTURE_USER_ID, FRIENDSHIP_FIXTURE_FRIEND_ID);
      await saveFriendship(repository, {
        followingId: FRIENDSHIP_FIXTURE_OTHER_USER_ID,
        status: "ACCEPTED",
      });
      await saveFriendship(repository, {
        followerId: FRIENDSHIP_FIXTURE_OTHER_USER_ID,
        followingId: FRIENDSHIP_FIXTURE_USER_ID,
      });

      // When
      const [count, friendIds, isFriend, isOneWay] = await Promise.all([
        repository.countMutualFriends(USER_ID),
        repository.listMutualFriendIds(USER_ID),
        repository.existsMutualFriendship(FRIEND_ID, USER_ID),
        repository.existsMutualFriendship(USER_ID, OTHER_USER_ID),
      ]);

      // Then
      expect(count).toBe(1);
      expect(friendIds.map((friendId) => friendId.value)).toEqual([FRIENDSHIP_FIXTURE_FRIEND_ID]);
      expect(isFriend).toBe(true);
      expect(isOneWay).toBe(false);
    });

    it("순서 밀기는 그 follower의 수락된 관계 중 구간 안만 옮기고 수정 시각을 바꾼다", async () => {
      // Given
      const repository = await createRepository();
      const first = await saveFriendship(repository, { status: "ACCEPTED", sortOrder: 0 });
      const second = await saveFriendship(repository, {
        followingId: FRIENDSHIP_FIXTURE_OTHER_USER_ID,
        status: "ACCEPTED",
        sortOrder: 1,
      });
      const foreign = await saveFriendship(repository, {
        followerId: FRIENDSHIP_FIXTURE_FRIEND_ID,
        followingId: FRIENDSHIP_FIXTURE_OTHER_USER_ID,
        status: "ACCEPTED",
        sortOrder: 1,
      });
      const pending = await saveFriendship(repository, {
        followerId: FRIENDSHIP_FIXTURE_USER_ID,
        followingId: FRIENDSHIP_FIXTURE_USER_ID,
        sortOrder: 1,
      });

      // When
      await repository.shiftFriendSortOrders(
        USER_ID,
        { fromSortOrder: 1, toSortOrder: null, delta: 1 },
        LATER,
      );

      // Then
      const [firstAfter, secondAfter, foreignAfter, pendingAfter] = await Promise.all([
        repository.findByFollowerAndFollowing(first.followerId, first.followingId),
        repository.findByFollowerAndFollowing(second.followerId, second.followingId),
        repository.findByFollowerAndFollowing(foreign.followerId, foreign.followingId),
        repository.findByFollowerAndFollowing(pending.followerId, pending.followingId),
      ]);
      expect(firstAfter?.toPrimitives()).toEqual(first.toPrimitives());
      expect(secondAfter?.toPrimitives()).toMatchObject({ sortOrder: 2, updatedAt: LATER });
      expect(foreignAfter?.sortOrder).toBe(1);
      expect(pendingAfter?.sortOrder).toBe(1);
    });

    it("지운 관계는 다시 찾지 못하고 반대 방향은 남는다", async () => {
      // Given
      const repository = await createRepository();
      const mine = await saveMutual(
        repository,
        FRIENDSHIP_FIXTURE_USER_ID,
        FRIENDSHIP_FIXTURE_FRIEND_ID,
      );

      // When
      await repository.delete(mine);

      // Then
      expect(await repository.findByFollowerAndFollowing(USER_ID, FRIEND_ID)).toBeNull();
      expect(await repository.findByFollowerAndFollowing(FRIEND_ID, USER_ID)).not.toBeNull();
    });
  });
}
