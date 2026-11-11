import { eq } from "drizzle-orm";

import { FriendshipId } from "#api/modules/social/friends/domain/friendship-id.vo";
import type { FriendshipPrimitives } from "#api/modules/social/friends/domain/friendship.aggregate";
import { UserTag } from "#api/modules/social/friends/domain/user-tag.vo";
import { DrizzleFollowRepository } from "#api/modules/social/friends/infrastructure/persistence/drizzle-follow.repository";
import { DrizzleFriendProfileReader } from "#api/modules/social/friends/infrastructure/persistence/drizzle-friend-profile.reader";
import { DrizzleFriendshipReader } from "#api/modules/social/friends/infrastructure/persistence/drizzle-friendship.reader";
import { user, userProfile } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { UserFixture } from "#test/fixtures/index";
import {
  createFriendshipFixture,
  FRIENDSHIP_FIXTURE_NOW,
} from "#test/fixtures/social/friendship.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const ME = "cme0000000000000000000001";
const ALPHA = "calpha000000000000000001";
const BRAVO = "cbravo000000000000000002";
const UNDERSCORE = "cunder000000000000000003";
const ONE_WAY = "conewy000000000000000004";
const LOCKED = "clockd000000000000000005";

describe("친구 목록·요청·프로필 조회 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let followRepository: DrizzleFollowRepository;
  let friendshipReader: DrizzleFriendshipReader;
  let profileReader: DrizzleFriendProfileReader;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        UserFixture.create({ id: ME, userTag: "MEME0001" }),
        UserFixture.create({ id: ALPHA, userTag: "ALPHA001" }),
        UserFixture.create({ id: BRAVO, userTag: "BRAVO002" }),
        UserFixture.create({ id: UNDERSCORE, userTag: "AL_PHA03" }),
        UserFixture.create({ id: ONE_WAY, userTag: "ONEWAY04" }),
        UserFixture.create({ id: LOCKED, userTag: "LOCKED05", status: "LOCKED" }),
      ]);
    await client.insert(userProfile).values([
      { userId: ME, name: "나" },
      { userId: ALPHA, name: "알파", profileImage: "alpha.png" },
    ]);
    const { txHost } = createDatabaseTransactionFixture(client);
    followRepository = new DrizzleFollowRepository(txHost);
    friendshipReader = new DrizzleFriendshipReader(txHost);
    profileReader = new DrizzleFriendProfileReader(txHost);
  });

  afterAll(async () => {
    await database.stop();
  });

  async function save(overrides: Partial<FriendshipPrimitives>) {
    const friendship = createFriendshipFixture({
      id: (await followRepository.nextId()).value,
      ...overrides,
    });
    await followRepository.save(friendship);
    return friendship;
  }

  async function befriend(friendId: string, sortOrder: number) {
    const mine = await save({
      followerId: ME,
      followingId: friendId,
      status: "ACCEPTED",
      sortOrder,
    });
    await save({ followerId: friendId, followingId: ME, status: "ACCEPTED" });
    return mine;
  }

  it("맞팔 친구만 순서·id 오름차순으로 주고 after 관계 뒤부터 이어 주며 없는 after면 빈 목록이다", async () => {
    // Given
    const bravo = await befriend(BRAVO, 1);
    const alpha = await befriend(ALPHA, 0);
    const underscore = await befriend(UNDERSCORE, 1);
    await save({ followerId: ME, followingId: ONE_WAY, status: "ACCEPTED", sortOrder: 0 });
    const userId = UserId.reconstitute(ME);
    const [tiedFirst, tiedSecond] =
      bravo.id.value < underscore.id.value ? [bravo, underscore] : [underscore, bravo];

    // When
    const all = await friendshipReader.listFriends({
      userId,
      afterFriendshipId: null,
      tagSearch: null,
      limit: 10,
    });
    const afterAlpha = await friendshipReader.listFriends({
      userId,
      afterFriendshipId: alpha.id,
      tagSearch: null,
      limit: 1,
    });
    const afterMissing = await friendshipReader.listFriends({
      userId,
      afterFriendshipId: FriendshipId.reconstitute("cmissing00000000000000000"),
      tagSearch: null,
      limit: 10,
    });

    // Then
    expect(all.map((friend) => friend.friendshipId)).toEqual([
      alpha.id.value,
      tiedFirst.id.value,
      tiedSecond.id.value,
    ]);
    expect(all[0]).toEqual({
      friendshipId: alpha.id.value,
      user: { id: ALPHA, userTag: "ALPHA001", name: "알파", profileImage: "alpha.png" },
      friendsSince: alpha.updatedAt,
    });
    expect(afterAlpha.map((friend) => friend.friendshipId)).toEqual([tiedFirst.id.value]);
    expect(afterMissing).toEqual([]);
  });

  it("태그 검색은 대소문자를 무시하고 %·_를 글자 그대로 찾는다", async () => {
    // Given
    await befriend(ALPHA, 0);
    await befriend(UNDERSCORE, 1);
    const userId = UserId.reconstitute(ME);

    // When
    const [byWord, byUnderscore, byPercent] = await Promise.all(
      ["alpha", "_", "%"].map((tagSearch) =>
        friendshipReader.listFriends({ userId, afterFriendshipId: null, tagSearch, limit: 10 }),
      ),
    );

    // Then
    expect(byWord?.map((friend) => friend.user.id)).toEqual([ALPHA]);
    expect(byUnderscore?.map((friend) => friend.user.id)).toEqual([UNDERSCORE]);
    expect(byPercent).toEqual([]);
  });

  it("관계 하나는 상태와 상관없이 상대 요약으로 읽고 프로필이 없으면 이름·사진은 null이다", async () => {
    // Given
    const pending = await save({ followerId: ME, followingId: BRAVO });

    // When
    const friend = await friendshipReader.findFriendById(pending.id);

    // Then
    expect(friend).toEqual({
      friendshipId: pending.id.value,
      user: { id: BRAVO, userTag: "BRAVO002", name: null, profileImage: null },
      friendsSince: pending.updatedAt,
    });
  });

  it("받은·보낸 대기 요청을 보낸 시각·id 내림차순으로 주고 after 요청 뒤부터 이어 준다", async () => {
    // Given
    const oldest = await save({ followerId: ALPHA, followingId: ME });
    const newest = await save({
      followerId: BRAVO,
      followingId: ME,
      createdAt: FRIENDSHIP_FIXTURE_NOW.add({ minutes: 2 }),
    });
    const middle = await save({
      followerId: UNDERSCORE,
      followingId: ME,
      createdAt: FRIENDSHIP_FIXTURE_NOW.add({ minutes: 1 }),
    });
    const sent = await save({ followerId: ME, followingId: ONE_WAY });
    await befriend(LOCKED, 0);
    const userId = UserId.reconstitute(ME);

    // When
    const firstPage = await friendshipReader.listReceivedRequests({
      userId,
      afterFriendshipId: null,
      limit: 2,
    });
    const nextPage = await friendshipReader.listReceivedRequests({
      userId,
      afterFriendshipId: middle.id,
      limit: 2,
    });
    const sentRequests = await friendshipReader.listSentRequests({
      userId,
      afterFriendshipId: null,
      limit: 10,
    });
    const counts = await Promise.all([
      friendshipReader.countReceivedRequests(userId),
      friendshipReader.countSentRequests(userId),
    ]);

    // Then
    expect(firstPage.map((request) => request.friendshipId)).toEqual([
      newest.id.value,
      middle.id.value,
    ]);
    expect(firstPage[0]).toEqual({
      friendshipId: newest.id.value,
      user: { id: BRAVO, userTag: "BRAVO002", name: null, profileImage: null },
      requestedAt: newest.createdAt,
    });
    expect(nextPage.map((request) => request.friendshipId)).toEqual([oldest.id.value]);
    expect(sentRequests.map((request) => request.user.id)).toEqual([ONE_WAY]);
    expect(sentRequests[0]?.friendshipId).toBe(sent.id.value);
    expect(counts).toEqual([3, 1]);
  });

  it("요청 대상은 활성 사용자만이고 표시 이름은 프로필 이름, 없으면 태그, 사용자가 없으면 null이다", async () => {
    // Given
    await client
      .update(user)
      .set({ deletedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()) })
      .where(eq(user.id, BRAVO));

    // When
    const [isActive, isLocked, isDeleted, byTag, byLockedTag, names] = await Promise.all([
      profileReader.existsActiveUser(UserId.reconstitute(ALPHA)),
      profileReader.existsActiveUser(UserId.reconstitute(LOCKED)),
      profileReader.existsActiveUser(UserId.reconstitute(BRAVO)),
      profileReader.findActiveUserIdByTag(UserTag.create("ALPHA001")),
      profileReader.findActiveUserIdByTag(UserTag.create("LOCKED05")),
      Promise.all(
        [ME, ONE_WAY, "cmissing00000000000000000"].map((userId) =>
          profileReader.findDisplayName(UserId.reconstitute(userId)),
        ),
      ),
    ]);

    // Then
    expect([isActive, isLocked, isDeleted]).toEqual([true, false, false]);
    expect(byTag?.value).toBe(ALPHA);
    expect(byLockedTag).toBeNull();
    expect(names).toEqual(["나", "ONEWAY04", null]);
  });
});
