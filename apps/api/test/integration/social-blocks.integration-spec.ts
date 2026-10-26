import { ErrorCode } from "@aido/api/errors";
import { omit } from "es-toolkit";
import sql from "sql-template-tag";

import type { FollowCachePort } from "#api/modules/social/application/ports/friends/follow-cache.port";
import type { FollowNotifierPort } from "#api/modules/social/application/ports/friends/follow-notifier.port";
import { FriendshipEffects } from "#api/modules/social/application/services/friends/friendship-effects.service";
import { BlockUser } from "#api/modules/social/application/use-cases/blocks/block-user.use-case";
import { AcceptFriendRequest } from "#api/modules/social/application/use-cases/friends/accept-friend-request.use-case";
import { SendFriendRequest } from "#api/modules/social/application/use-cases/friends/send-friend-request.use-case";
import { PrismaUserBlockRepository } from "#api/modules/social/infrastructure/persistence/blocks/prisma-user-block.repository";
import { PrismaCheerRepository } from "#api/modules/social/infrastructure/persistence/cheers/prisma-cheer.repository";
import { PrismaFollowRepository } from "#api/modules/social/infrastructure/persistence/friends/prisma-follow.repository";
import { PrismaNudgeRepository } from "#api/modules/social/infrastructure/persistence/nudges/prisma-nudge.repository";
import { encodeCreate } from "#api/platform/database/database-records";
import { sqlStatement } from "#api/platform/database/database-sql";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import { MutationLockKeys } from "#api/shared/application/ports/index";
import {
  CheerFixture,
  FollowFixture,
  NudgeFixture,
  TodoCategoryFixture,
  TodoFixture,
  UserFixture,
} from "#test/fixtures/index";
import {
  createDatabaseTransactionFixture,
  createTestClient,
  withDatabaseTransaction,
} from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const BLOCK_TIME = new Date("2027-01-08T12:00:00Z");

describe("사용자 차단 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let meId: string;
  let otherId: string;
  let otherTag: string;
  let blockUser: BlockUser;
  let acceptFriendRequest: AcceptFriendRequest;
  let sendFriendRequest: SendFriendRequest;
  let followRepository: PrismaFollowRepository;
  let blockRepository: PrismaUserBlockRepository;
  let nudgeRepository: PrismaNudgeRepository;
  let cheerRepository: PrismaCheerRepository;

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
    await client.orm.public.User.createAll(
      [me, other].map((user) => encodeCreate("User", { ...user, status: "ACTIVE" })),
    );
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
    followRepository = new PrismaFollowRepository(txHost);
    blockRepository = new PrismaUserBlockRepository(txHost);
    nudgeRepository = new PrismaNudgeRepository(txHost);
    cheerRepository = new PrismaCheerRepository(txHost);
    const effects = new FriendshipEffects({ followRepository, cache, notifier, logger });
    blockUser = new BlockUser({
      userBlockRepository: blockRepository,
      unitOfWork: uow,
      mutationLock,
      friendshipCache: cache,
      logger,
    });
    acceptFriendRequest = new AcceptFriendRequest({
      followRepository,
      unitOfWork: uow,
      mutationLock,
      effects,
      logger,
    });
    sendFriendRequest = new SendFriendRequest({
      followRepository,
      notifier,
      unitOfWork: uow,
      mutationLock,
      entitlementReader: {
        getResourceLimitInTx: async () => ({
          maxCount: null,
          isAdmin: false,
          subscriptionStatus: "ACTIVE",
        }),
      },
      blockReader: blockRepository,
      effects,
      logger,
    });
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    await database.stop();
  });

  async function countFollowsBetween(): Promise<number> {
    const rows = await client.orm.public.Follow.select("followerId", "followingId").all();
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
    const pairKey = MutationLockKeys.friendPair(meId, otherId);
    const holding = withDatabaseTransaction(client, async (tx) => {
      await tx.query(
        sqlStatement(
          tx,
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${pairKey}, 0))::TEXT AS "locked"`,
        )
          .returnsRow({ locked: "pg/text@1" })
          .build(),
      );
      acquired.resolve();
      await released.promise;
    });
    await acquired.promise;
    const outcomes = Promise.allSettled([first(), second()]);
    try {
      await vi.waitFor(
        async () => {
          const waiting = await client
            .runtime()
            .query(
              client.raw
                .sql`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`
                .returnsRow({ count: "pg/int4@1" })
                .build(),
            );
          expect(waiting[0]?.count).toBe(2);
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
    await client.orm.public.Follow.create(
      encodeCreate("Follow", FollowFixture.create({ followerId: otherId, followingId: meId })),
    );

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
    expect(await blockRepository.findRelation(meId, otherId)).toEqual({
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
    await client.orm.public.Follow.createAll([
      encodeCreate(
        "Follow",
        FollowFixture.create({ followerId: meId, followingId: otherId, status: "ACCEPTED" }),
      ),
      encodeCreate(
        "Follow",
        FollowFixture.create({ followerId: otherId, followingId: meId, status: "ACCEPTED" }),
      ),
    ]);

    // When
    const outcomes = await compete(
      () => blockUser.execute({ blockerId: meId, blockedId: otherId }),
      () => blockUser.execute({ blockerId: otherId, blockedId: meId }),
    );

    // Then
    expect(outcomes.map((outcome) => outcome.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await countFollowsBetween()).toBe(0);
    expect(await blockRepository.findRelation(meId, otherId)).toEqual({
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
    const blocks = await client.orm.public.UserBlock.select("id").all();
    expect(blocks).toHaveLength(1);
  });

  it("차단하면 서로의 콕·응원 기록과 개수, 사용자 검색에서 상대가 빠진다", async () => {
    // Given
    const { id: categoryId } = await client.orm.public.TodoCategory.create(
      encodeCreate("TodoCategory", TodoCategoryFixture.create({ userId: meId, sortOrder: 0 })),
    );
    const todo = await client.orm.public.Todo.create(
      encodeCreate(
        "Todo",
        omit(TodoFixture.create({ userId: meId, categoryId, sortOrder: 0 }), ["id"]),
      ),
    );
    await client.orm.public.Nudge.create(
      encodeCreate(
        "Nudge",
        omit(NudgeFixture.create({ senderId: otherId, receiverId: meId, todoId: todo.id }), ["id"]),
      ),
    );
    await client.orm.public.Cheer.create(
      encodeCreate(
        "Cheer",
        omit(CheerFixture.create({ senderId: meId, receiverId: otherId }), ["id"]),
      ),
    );
    await blockUser.execute({ blockerId: meId, blockedId: otherId });

    // When
    const [receivedNudges, unreadNudges, sentCheers, cheersSeenByBlocked, searchResults] =
      await Promise.all([
        nudgeRepository.findReceivedNudges({ userId: meId, size: 10 }),
        nudgeRepository.countUnreadReceived(meId),
        cheerRepository.findSentCheers({ userId: meId, size: 10 }),
        cheerRepository.findReceivedCheers({ userId: otherId, size: 10 }),
        followRepository.searchUsers({
          viewerId: meId,
          nfcQuery: otherTag,
          upperTag: otherTag,
          size: 10,
        }),
      ]);

    // Then
    expect(receivedNudges).toEqual([]);
    expect(unreadNudges).toBe(0);
    expect(sentCheers).toEqual([]);
    expect(cheersSeenByBlocked).toEqual([]);
    expect(searchResults).toEqual([]);
    expect(
      await followRepository.countSearchUsers({
        viewerId: otherId,
        nfcQuery: "",
        upperTag: "",
      }),
    ).toBe(0);
  });

  it("차단하면 콕 하나를 열어도 보낸 사람·받은 사람 모두에게 없는 콕이다", async () => {
    // Given
    const { id: categoryId } = await client.orm.public.TodoCategory.create(
      encodeCreate("TodoCategory", TodoCategoryFixture.create({ userId: meId, sortOrder: 0 })),
    );
    const todo = await client.orm.public.Todo.create(
      encodeCreate(
        "Todo",
        omit(TodoFixture.create({ userId: meId, categoryId, sortOrder: 0 }), ["id"]),
      ),
    );
    const nudge = await client.orm.public.Nudge.create(
      encodeCreate(
        "Nudge",
        omit(NudgeFixture.create({ senderId: otherId, receiverId: meId, todoId: todo.id }), ["id"]),
      ),
    );
    const [receivedBeforeBlock, sentBeforeBlock] = await Promise.all([
      nudgeRepository.findInteractionById(nudge.id, meId),
      nudgeRepository.findInteractionById(nudge.id, otherId),
    ]);
    await blockUser.execute({ blockerId: meId, blockedId: otherId });

    // When
    const [receivedAfterBlock, sentAfterBlock] = await Promise.all([
      nudgeRepository.findInteractionById(nudge.id, meId),
      nudgeRepository.findInteractionById(nudge.id, otherId),
    ]);

    // Then
    expect(receivedBeforeBlock?.id).toBe(nudge.id);
    expect(sentBeforeBlock?.id).toBe(nudge.id);
    expect(receivedAfterBlock).toBeNull();
    expect(sentAfterBlock).toBeNull();
  });
});
