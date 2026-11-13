import { ErrorCode } from "@aido/api/errors";
import { sql } from "drizzle-orm";
import { omit } from "es-toolkit";

import { BlockUserUseCase } from "#api/modules/social/blocks/application/use-cases/block-user.use-case";
import { DrizzleUserBlockRepository } from "#api/modules/social/blocks/infrastructure/persistence/drizzle-user-block.repository";
import { DrizzleCheerRepository } from "#api/modules/social/cheers/infrastructure/persistence/drizzle-cheer.repository";
import { FriendLockKeys } from "#api/modules/social/friends/application/friends.lock-keys";
import type { FollowCachePort } from "#api/modules/social/friends/application/ports/follow-cache.port";
import type { FollowNotifierPort } from "#api/modules/social/friends/application/ports/follow-notifier.port";
import { AcceptFriendRequestUseCase } from "#api/modules/social/friends/application/use-cases/accept-friend-request.use-case";
import { CheckFirstFriendMilestoneUseCase } from "#api/modules/social/friends/application/use-cases/check-first-friend-milestone.use-case";
import { SendFriendRequestUseCase } from "#api/modules/social/friends/application/use-cases/send-friend-request.use-case";
import { UserSearchTerm } from "#api/modules/social/friends/domain/user-search-term.vo";
import { DrizzleFollowRepository } from "#api/modules/social/friends/infrastructure/persistence/drizzle-follow.repository";
import { DrizzleFriendProfileReader } from "#api/modules/social/friends/infrastructure/persistence/drizzle-friend-profile.reader";
import { DrizzleFriendSearchReader } from "#api/modules/social/friends/infrastructure/persistence/drizzle-friend-search.reader";
import { DrizzleFriendshipReader } from "#api/modules/social/friends/infrastructure/persistence/drizzle-friendship.reader";
import { NudgeId } from "#api/modules/social/nudges/domain/nudge-id.vo";
import { DrizzleNudgeRepository } from "#api/modules/social/nudges/infrastructure/persistence/drizzle-nudge.repository";
import { requireRecord } from "#api/platform/database/database-error.util";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import {
  cheer,
  follow,
  nudge,
  todo,
  todoCategory,
  user,
  userBlock,
} from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { DateClock } from "#test/doubles/platform/date-clock";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { PassThroughCountCache } from "#test/doubles/social/pass-through-count-cache";
import {
  CheerFixture,
  FollowFixture,
  NudgeFixture,
  TodoCategoryFixture,
  TodoFixture,
  UserFixture,
} from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const BLOCK_TIME = new Date("2027-01-08T12:00:00Z");

describe("사용자 차단 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let meId: string;
  let otherId: string;
  let otherTag: string;
  let blockUser: BlockUserUseCase;
  let acceptFriendRequest: AcceptFriendRequestUseCase;
  let sendFriendRequest: SendFriendRequestUseCase;
  let friendSearchReader: DrizzleFriendSearchReader;
  let blockRepository: DrizzleUserBlockRepository;
  let nudgeRepository: DrizzleNudgeRepository;
  let cheerRepository: DrizzleCheerRepository;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BLOCK_TIME);
    const me = UserFixture.create();
    const other = UserFixture.create();
    await client.insert(user).values([
      { ...me, status: "ACTIVE" },
      { ...other, status: "ACTIVE" },
    ]);
    meId = me.id;
    otherId = other.id;
    otherTag = other.userTag;

    const { txHost, uow } = createDatabaseTransactionFixture(client);
    const mutationLock = new PostgresMutationLockAdapter(txHost);
    const cache: FollowCachePort = {
      getMutualFriend: async () => undefined,
      setMutualFriend: async () => {},
      invalidateMutualFriend: async () => {},
      wrapMutualFriendIds: async (_userId, read) => read(),
      invalidateMutualFriendIds: async () => {},
      wrapFriendCount: async (_userId, read) => read(),
      invalidateFriendCount: async () => {},
    };
    const notifier: FollowNotifierPort = {
      notifyFollowNew() {},
      notifyFollowMutual() {},
      notifyFirstFriendMilestone() {},
    };
    const logger = { log() {}, debug() {}, warn() {}, error() {} };
    const followRepository = new DrizzleFollowRepository(txHost);
    const profileReader = new DrizzleFriendProfileReader(txHost);
    friendSearchReader = new DrizzleFriendSearchReader(txHost);
    blockRepository = new DrizzleUserBlockRepository(txHost);
    nudgeRepository = new DrizzleNudgeRepository(txHost);
    cheerRepository = new DrizzleCheerRepository(txHost);
    const clock = new DateClock();
    const checkFirstFriendMilestone = new CheckFirstFriendMilestoneUseCase({
      followRepository,
      notifier,
      logger,
    });
    blockUser = new BlockUserUseCase({
      nudgeCountCache: new PassThroughCountCache(),
      cheerCountCache: new PassThroughCountCache(),
      userBlockRepository: blockRepository,
      unitOfWork: uow,
      mutationLock,
      friendshipCache: cache,
      clock: new FixedClock(instantFromDate(BLOCK_TIME)),
      logger,
    });
    acceptFriendRequest = new AcceptFriendRequestUseCase({
      unitOfWork: uow,
      mutationLock,
      followRepository,
      friendshipReader: new DrizzleFriendshipReader(txHost),
      profileReader,
      cache,
      notifier,
      checkFirstFriendMilestone,
      clock,
      logger,
    });
    sendFriendRequest = new SendFriendRequestUseCase({
      unitOfWork: uow,
      mutationLock,
      followRepository,
      profileReader,
      limitReader: {
        readLimitInTx: async () => null,
        readFeatureQuotaInTx: async () => {
          throw new Error("친구 한도가 없으면 한도 오류 featureQuota를 읽지 않는다");
        },
      },
      blockReader: blockRepository,
      cache,
      notifier,
      checkFirstFriendMilestone,
      clock,
      logger,
    });
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    await database.stop();
  });

  async function countFollowsBetween(): Promise<number> {
    const rows = await client
      .select({ followerId: follow.followerId, followingId: follow.followingId })
      .from(follow);
    return rows.filter(
      (row) =>
        (row.followerId === meId && row.followingId === otherId) ||
        (row.followerId === otherId && row.followingId === meId),
    ).length;
  }

  /** 두 사람의 친구 쌍 잠금을 잡아 두 요청이 실제로 같은 잠금 앞에서 기다리게 한다. */
  async function compete(first: () => Promise<unknown>, second: () => Promise<unknown>) {
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const pairKey = FriendLockKeys.pair(UserId.reconstitute(meId), UserId.reconstitute(otherId));
    const holding = client.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${pairKey}, 0))`);
      acquired.resolve();
      await released.promise;
    });
    await acquired.promise;
    const outcomes = Promise.allSettled([first(), second()]);
    try {
      await vi.waitFor(
        async () => {
          const waiting = await client.execute<{ count: number }>(
            sql`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`,
          );
          expect(waiting.rows[0]?.count).toBe(2);
        },
        { timeout: 5000, interval: 10 },
      );
    } finally {
      released.resolve();
      await holding;
    }
    return outcomes;
  }

  it("대기 중인 친구 요청을 수락하는 동안 차단해도 차단 뒤에는 친구 관계가 남지 않는다", async () => {
    // Given
    await client
      .insert(follow)
      .values(FollowFixture.create({ followerId: otherId, followingId: meId }));

    // When
    const [acceptance, block] = await compete(
      () => acceptFriendRequest.execute({ userId: meId, requesterUserId: otherId }),
      () => blockUser.execute({ blockerId: otherId, blockedId: meId }),
    );

    // Then
    expect(block?.status).toBe("fulfilled");
    if (acceptance?.status === "rejected") {
      expect(acceptance.reason).toMatchObject({ errorCode: ErrorCode.FOLLOW_0903 });
    }
    expect(await countFollowsBetween()).toBe(0);
    expect(
      await blockRepository.findRelation(UserId.reconstitute(meId), UserId.reconstitute(otherId)),
    ).toEqual({
      isBlocking: false,
      isBlockedBy: true,
    });
  });

  it("친구 요청을 보내는 동안 상대가 나를 차단하면 요청이 남지 않는다", async () => {
    // When
    const [request, block] = await compete(
      () => sendFriendRequest.execute({ userId: meId, targetUserId: otherId }),
      () => blockUser.execute({ blockerId: otherId, blockedId: meId }),
    );

    // Then
    expect(block?.status).toBe("fulfilled");
    if (request?.status === "rejected") {
      expect(request.reason).toMatchObject({ errorCode: ErrorCode.FOLLOW_0905 });
    }
    expect(await countFollowsBetween()).toBe(0);
  });

  it("서로 동시에 차단하면 두 차단이 모두 남고 친구 관계가 끊긴다", async () => {
    // Given
    await client
      .insert(follow)
      .values([
        FollowFixture.create({ followerId: meId, followingId: otherId, status: "ACCEPTED" }),
        FollowFixture.create({ followerId: otherId, followingId: meId, status: "ACCEPTED" }),
      ]);

    // When
    const outcomes = await compete(
      () => blockUser.execute({ blockerId: meId, blockedId: otherId }),
      () => blockUser.execute({ blockerId: otherId, blockedId: meId }),
    );

    // Then
    expect(outcomes.map((outcome) => outcome.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await countFollowsBetween()).toBe(0);
    expect(
      await blockRepository.findRelation(UserId.reconstitute(meId), UserId.reconstitute(otherId)),
    ).toEqual({
      isBlocking: true,
      isBlockedBy: true,
    });
  });

  it("같은 사용자를 동시에 두 번 차단해도 차단 행은 하나다", async () => {
    // When
    const outcomes = await compete(
      () => blockUser.execute({ blockerId: meId, blockedId: otherId }),
      () => blockUser.execute({ blockerId: meId, blockedId: otherId }),
    );

    // Then
    expect(outcomes.map((outcome) => outcome.status)).toEqual(["fulfilled", "fulfilled"]);
    const blocks = await client.select({ id: userBlock.id }).from(userBlock);
    expect(blocks).toHaveLength(1);
  });

  it("차단하면 서로의 콕·응원 기록과 개수, 사용자 검색에서 상대가 빠진다", async () => {
    // Given
    const [category] = await client
      .insert(todoCategory)
      .values(TodoCategoryFixture.create({ userId: meId, sortOrder: 0 }))
      .returning();
    const categoryId = requireRecord(category).id;
    const [createdTodo] = await client
      .insert(todo)
      .values(omit(TodoFixture.create({ userId: meId, categoryId, sortOrder: 0 }), ["id"]))
      .returning();
    const todoId = requireRecord(createdTodo).id;
    await client
      .insert(nudge)
      .values(omit(NudgeFixture.create({ senderId: otherId, receiverId: meId, todoId }), ["id"]));
    await client
      .insert(cheer)
      .values(omit(CheerFixture.create({ senderId: meId, receiverId: otherId }), ["id"]));
    await blockUser.execute({ blockerId: meId, blockedId: otherId });

    // When
    const [receivedNudges, unreadNudges, sentCheers, cheersSeenByBlocked, searchResults] =
      await Promise.all([
        nudgeRepository.listReceived({
          userId: UserId.reconstitute(meId),
          afterNudgeId: null,
          limit: 10,
        }),
        nudgeRepository.countUnreadReceived(UserId.reconstitute(meId)),
        cheerRepository.listSent({
          userId: UserId.reconstitute(meId),
          afterCheerId: null,
          limit: 10,
        }),
        cheerRepository.listReceived({
          userId: UserId.reconstitute(otherId),
          afterCheerId: null,
          limit: 10,
        }),
        friendSearchReader.searchUsers({
          viewerId: UserId.reconstitute(meId),
          term: UserSearchTerm.create(otherTag),
          after: null,
          limit: 10,
        }),
      ]);

    // Then
    expect(receivedNudges).toEqual([]);
    expect(unreadNudges).toBe(0);
    expect(sentCheers).toEqual([]);
    expect(cheersSeenByBlocked).toEqual([]);
    expect(searchResults).toEqual([]);
    expect(
      await friendSearchReader.countUsers({
        viewerId: UserId.reconstitute(otherId),
        term: UserSearchTerm.reconstitute(""),
      }),
    ).toBe(0);
  });

  it("차단하면 콕 하나를 열어도 보낸 사람·받은 사람 모두에게 없는 콕이다", async () => {
    // Given
    const [category] = await client
      .insert(todoCategory)
      .values(TodoCategoryFixture.create({ userId: meId, sortOrder: 0 }))
      .returning();
    const categoryId = requireRecord(category).id;
    const [createdTodo] = await client
      .insert(todo)
      .values(omit(TodoFixture.create({ userId: meId, categoryId, sortOrder: 0 }), ["id"]))
      .returning();
    const todoId = requireRecord(createdTodo).id;
    const [createdNudge] = await client
      .insert(nudge)
      .values(omit(NudgeFixture.create({ senderId: otherId, receiverId: meId, todoId }), ["id"]))
      .returning();
    const nudgeId = requireRecord(createdNudge).id;
    const [receivedBeforeBlock, sentBeforeBlock] = await Promise.all([
      nudgeRepository.findInteraction(NudgeId.reconstitute(nudgeId), UserId.reconstitute(meId)),
      nudgeRepository.findInteraction(NudgeId.reconstitute(nudgeId), UserId.reconstitute(otherId)),
    ]);
    await blockUser.execute({ blockerId: meId, blockedId: otherId });

    // When
    const [receivedAfterBlock, sentAfterBlock] = await Promise.all([
      nudgeRepository.findInteraction(NudgeId.reconstitute(nudgeId), UserId.reconstitute(meId)),
      nudgeRepository.findInteraction(NudgeId.reconstitute(nudgeId), UserId.reconstitute(otherId)),
    ]);

    // Then
    expect(receivedBeforeBlock?.id).toBe(nudgeId);
    expect(sentBeforeBlock?.id).toBe(nudgeId);
    expect(receivedAfterBlock).toBeNull();
    expect(sentAfterBlock).toBeNull();
  });
});
