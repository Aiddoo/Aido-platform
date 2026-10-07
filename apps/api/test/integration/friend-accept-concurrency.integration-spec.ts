import { ErrorCode } from "@aido/api/errors";
import sql from "sql-template-tag";

import type { FollowCachePort } from "#api/modules/social/application/ports/friends/follow-cache.port";
import type { FollowNotifierPort } from "#api/modules/social/application/ports/friends/follow-notifier.port";
import { FriendshipEffects } from "#api/modules/social/application/services/friends/friendship-effects.service";
import { AcceptFriendRequest } from "#api/modules/social/application/use-cases/friends/accept-friend-request.use-case";
import { PrismaFollowRepository } from "#api/modules/social/infrastructure/persistence/friends/prisma-follow.repository";
import { encodeCreate } from "#api/platform/database/database-records";
import { sqlStatement } from "#api/platform/database/database-sql";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import { UserFixture, FollowFixture } from "#test/fixtures/index";
import {
  createTestClient,
  createDatabaseTransactionFixture,
  withDatabaseTransaction,
} from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const ACCEPTANCE_TIME = new Date("2027-01-08T12:00:00Z");

describe("친구 수락 경쟁 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let receiverId: string;
  let firstSenderId: string;
  let secondSenderId: string;
  let requestId: string;
  let acceptFriendRequest: AcceptFriendRequest;
  let mutualNotifications: number;
  let milestoneNotifications: number;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ACCEPTANCE_TIME);
    mutualNotifications = 0;
    milestoneNotifications = 0;
    const receiver = UserFixture.create();
    const firstSender = UserFixture.create();
    const secondSender = UserFixture.create();
    const users = [receiver, firstSender, secondSender];
    await client.orm.public.User.createAll(users.map((user) => encodeCreate("User", user)));
    receiverId = receiver.id;
    firstSenderId = firstSender.id;
    secondSenderId = secondSender.id;
    const request = await client.orm.public.Follow.create(
      encodeCreate(
        "Follow",
        FollowFixture.create({ followerId: firstSenderId, followingId: receiverId }),
      ),
    );
    requestId = request.id;
    const { txHost, uow } = createDatabaseTransactionFixture(client);
    const followRepository = new PrismaFollowRepository(txHost);
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
      notifyFollowMutual() {
        mutualNotifications++;
      },
      notifyFirstFriendMilestone() {
        milestoneNotifications++;
      },
    };
    const logger = { log() {}, debug() {}, warn() {}, error() {} };
    const effects = new FriendshipEffects({ followRepository, cache, notifier, logger });
    acceptFriendRequest = new AcceptFriendRequest({
      followRepository,
      unitOfWork: uow,
      mutationLock: new PostgresMutationLockAdapter(txHost),
      effects,
      logger,
    });
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    await database.stop();
  });

  async function hold(kind: "request" | "receiver") {
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const holding = withDatabaseTransaction(client, async (tx) => {
      if (kind === "request") {
        await tx.query(
          sqlStatement(tx, sql`SELECT "id" FROM "Follow" WHERE "id"=${requestId} FOR UPDATE`)
            .returnsRow({ id: "pg/text@1" })
            .build(),
        );
      } else {
        await tx.query(
          sqlStatement(tx, sql`SELECT "id" FROM "User" WHERE "id"=${receiverId} FOR UPDATE`)
            .returnsRow({ id: "pg/text@1" })
            .build(),
        );
      }
      acquired.resolve();
      await released.promise;
    });
    await Promise.race([
      acquired.promise,
      holding.then(() => {
        throw new Error("잠금 조기 종료");
      }),
    ]);
    return async () => {
      released.resolve();
      await holding;
    };
  }

  async function compete(
    kind: "request" | "receiver",
    first: () => Promise<unknown>,
    second: () => Promise<unknown>,
  ) {
    const release = await hold(kind);
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
      await release();
      await outcomes;
    }
    return outcomes;
  }

  it("순차 재수락은 기존 FOLLOW0903 오류와 알림 1세트를 유지한다", async () => {
    // Given
    await acceptFriendRequest.execute({ userId: receiverId, requesterUserId: firstSenderId });
    // When
    const repeatedAcceptance = acceptFriendRequest.execute({
      userId: receiverId,
      requesterUserId: firstSenderId,
    });

    // Then
    await expect(repeatedAcceptance).rejects.toMatchObject({ errorCode: ErrorCode.FOLLOW_0903 });
    expect(mutualNotifications).toBe(2);
  });

  it("동일 요청 두 수락은 하나만 처리하고 친구 알림을 1세트 발행해야 한다", async () => {
    // Given: 같은 요청 행을 잠가 두 수락이 실제 PostgreSQL에서 대기하도록 한다.
    // When
    const results = await compete(
      "request",
      () => acceptFriendRequest.execute({ userId: receiverId, requesterUserId: firstSenderId }),
      () => acceptFriendRequest.execute({ userId: receiverId, requesterUserId: firstSenderId }),
    );
    const accepted = await client.orm.public.Follow.where({ status: "ACCEPTED" })
      .select("id")
      .all();
    process.stdout.write(
      "FRIENDS_ACCEPT_RESULT " +
        JSON.stringify({
          scenario: "same-request",
          fulfilled: results.filter((result) => result.status === "fulfilled").length,
          rejected: results.filter((result) => result.status === "rejected").length,
          acceptedRows: accepted.length,
          mutualNotifications,
          milestoneNotifications,
          observedBlockedRequests: 2,
        }) +
        "\n",
    );
    // Then
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toEqual([
      { status: "rejected", reason: expect.objectContaining({ errorCode: ErrorCode.FOLLOW_0903 }) },
    ]);
    expect(accepted).toHaveLength(2);
    expect(mutualNotifications).toBe(2);
    expect(milestoneNotifications).toBe(2);
  });

  it("서로 다른 요청 두 수락은 사용자 친구 sortOrder가 겹치지 않아야 한다", async () => {
    // Given
    await client.orm.public.Follow.create(
      encodeCreate(
        "Follow",
        FollowFixture.create({ followerId: secondSenderId, followingId: receiverId }),
      ),
    );
    // When
    const results = await compete(
      "receiver",
      () => acceptFriendRequest.execute({ userId: receiverId, requesterUserId: firstSenderId }),
      () => acceptFriendRequest.execute({ userId: receiverId, requesterUserId: secondSenderId }),
    );
    const accepted = await client.orm.public.Follow.where({
      followerId: receiverId,
      status: "ACCEPTED",
    })
      .select("sortOrder")
      .all();
    process.stdout.write(
      "FRIENDS_ACCEPT_RESULT " +
        JSON.stringify({
          scenario: "distinct-requesters",
          fulfilled: results.filter((result) => result.status === "fulfilled").length,
          acceptedRows: accepted.length,
          sortOrders: accepted.map((row) => row.sortOrder),
          uniqueSortOrders: new Set(accepted.map((row) => row.sortOrder)).size,
          observedBlockedRequests: 2,
        }) +
        "\n",
    );
    // Then
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(accepted.map((row) => row.sortOrder).sort((first, second) => first - second)).toEqual([
      0, 1,
    ]);
    expect(mutualNotifications).toBe(4);
  });
});
