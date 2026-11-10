import { and, eq, sql } from "drizzle-orm";
import { omit } from "es-toolkit";
import { Pool } from "pg";

import { CheerReaderPort } from "#api/modules/social/cheers/application/ports/cheer.reader.port";
import { CheerRepositoryPort } from "#api/modules/social/cheers/application/ports/cheer.repository.port";
import { MarkCheerReadUseCase } from "#api/modules/social/cheers/application/use-cases/mark-cheer-read.use-case";
import { SendCheerUseCase } from "#api/modules/social/cheers/application/use-cases/send-cheer.use-case";
import { FollowRepositoryPort } from "#api/modules/social/friends/application/ports/follow.repository.port";
import { FriendSearchReaderPort } from "#api/modules/social/friends/application/ports/friend-search.reader.port";
import { UserSearchTerm } from "#api/modules/social/friends/domain/user-search-term.vo";
import { NudgeRepositoryPort } from "#api/modules/social/nudges/application/ports/nudge.repository.port";
import { SendNudgeUseCase } from "#api/modules/social/nudges/application/use-cases/send-nudge.use-case";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  cheer,
  follow,
  nudge,
  todo,
  todoCategory,
  user as userTable,
  userProfile,
} from "#api/platform/database/schema/index";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { UserFixture, TodoFixture, TodoCategoryFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const AT = new Date("2027-01-04T20:00:00.000Z");
const SEED_AT = new Date("2027-01-04T19:00:00.000Z");
let recording: string[] | null = null;

describe("Social 일일 한도·쿨다운·조회 쿼리 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let lockPool: Pool;
  let senderId: string;
  let receiverIds: string[];
  let todoIds: number[];
  beforeAll(async () => {
    database = new TestDatabase({
      createClient: (url) =>
        createTestClient(url, { max: 4 }, (statement) => {
          if (recording !== null) {
            recording.push(statement);
          }
        }),
    });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    lockPool = new Pool({ connectionString: database.getConnectionUri(), max: 1 });
  });
  beforeEach(async () => {
    recording = null;
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const users = [];
    for (let index = 0; index < 5; index++) {
      const user = UserFixture.create({
        id: createEntityId(),
        email: `social-regression-${index}@example.com`,
        userTag: `SOCPG00${index}`,
      });
      await client.insert(userTable).values(user);
      users.push(user.id);
    }
    senderId = users[0] ?? "";
    receiverIds = users.slice(1);
    todoIds = [];
    for (const [index, receiverId] of receiverIds.entries()) {
      await client.insert(follow).values([
        {
          followerId: senderId,
          followingId: receiverId,
          status: "ACCEPTED",
          sortOrder: index,
          updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        },
        {
          followerId: receiverId,
          followingId: senderId,
          status: "ACCEPTED",
          sortOrder: 0,
          updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        },
      ]);
      const [category] = await client
        .insert(todoCategory)
        .values(TodoCategoryFixture.create({ userId: receiverId, sortOrder: 0 }))
        .returning({ id: todoCategory.id });
      if (category === undefined) {
        throw new Error("category fixture 누락");
      }
      const todoFixture = TodoFixture.create({
        userId: receiverId,
        categoryId: category.id,
        visibility: "PUBLIC",
        startDate: Temporal.PlainDate.from("2027-01-04"),
        endDate: Temporal.PlainDate.from("2027-01-05"),
        sortOrder: 0,
      });
      const [row] = await client
        .insert(todo)
        .values(omit(todoFixture, ["id"]))
        .returning({ id: todo.id });
      if (row === undefined) {
        throw new Error("todo fixture 누락");
      }
      todoIds.push(row.id);
    }
  });
  afterEach(() => {
    recording = null;
    vi.useRealTimers();
  });
  afterAll(async () => {
    await lockPool?.end();
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  async function contend<T>(first: () => Promise<T>, second: () => Promise<T>) {
    const holding = await lockPool.connect();
    await holding.query("BEGIN");
    await holding.query('SELECT "id" FROM "User" WHERE "id"=$1 FOR UPDATE', [senderId]);
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
      const waiting = await client.execute<{ query: string }>(
        sql`SELECT query FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' ORDER BY query`,
      );
      expect(waiting.rows).toHaveLength(2);
    } finally {
      await holding.query("COMMIT");
      holding.release();
    }
    return outcomes;
  }
  async function seed(kind: "Cheer" | "Nudge") {
    for (let index = 0; index < 2; index++) {
      const receiverId = receiverIds[index];
      if (receiverId === undefined) {
        throw new Error("receiver fixture 누락");
      }
      if (kind === "Cheer") {
        await client
          .insert(cheer)
          .values({ senderId, receiverId, message: null, createdAt: instantFromDate(SEED_AT) });
      } else {
        const todoId = todoIds[index];
        if (todoId === undefined) {
          throw new Error("todo fixture 누락");
        }
        await client.insert(nudge).values({
          senderId,
          receiverId,
          todoId,
          message: null,
          createdAt: instantFromDate(SEED_AT),
        });
      }
    }
  }
  async function usage(kind: "Cheer" | "Nudge") {
    const repo =
      kind === "Cheer"
        ? context.module.get(CheerRepositoryPort)
        : context.module.get(NudgeRepositoryPort);
    return Promise.all(
      ["UTC", "Asia/Seoul"].map(async (tz) => {
        const window = dayWindowInTimezone(AT, tz);
        return {
          tz,
          localDate: window.localDate,
          startsAt: window.startsAt.toISOString(),
          endsAt: window.endsAt.toISOString(),
          used: await repo.countSentBetween(UserId.reconstitute(senderId), {
            startsAt: instantFromDate(window.startsAt),
            endsAt: instantFromDate(window.endsAt),
          }),
        };
      }),
    );
  }
  for (const kind of ["Cheer", "Nudge"] as const) {
    for (const mixedTimezone of [false, true]) {
      it(`${kind} 기존 2회와 동시 2회 요청은 ${mixedTimezone ? "서로 다른 날짜 시간대에서도" : "같은 시간대에서"} 하루 3회까지만 허용한다`, async () => {
        // Given
        await seed(kind);
        const execute = (index: number, tz: string) => {
          const receiverId = receiverIds[index];
          const todoId = todoIds[index];
          if (receiverId === undefined || todoId === undefined) {
            throw new Error("요청 fixture 누락");
          }
          return kind === "Cheer"
            ? context.module.get(SendCheerUseCase).execute({ senderId, receiverId, timezone: tz })
            : context.module
                .get(SendNudgeUseCase)
                .execute({ senderId, receiverId, todoId, timezone: tz });
        };

        // When
        const results = await contend(
          () => execute(2, "UTC"),
          () => execute(3, mixedTimezone ? "Asia/Seoul" : "UTC"),
        );
        const after = await usage(kind);
        const fulfilled = results.filter((result) => result.status === "fulfilled").length;

        // Then
        expect(fulfilled).toBe(1);
        expect(after.every((row) => row.used === 3)).toBe(true);
      });
    }
  }
  it("같은 친구에게 동시에 보낸 응원은 시간대가 달라도 쿨다운으로 하나만 허용한다", async () => {
    // Given
    const receiverId = receiverIds[0];
    if (receiverId === undefined) {
      throw new Error("receiver fixture 누락");
    }
    const send = context.module.get(SendCheerUseCase);

    // When
    const results = await contend(
      () => send.execute({ senderId, receiverId, timezone: "UTC" }),
      () => send.execute({ senderId, receiverId, timezone: "Asia/Seoul" }),
    );

    // Then
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")?.reason).toMatchObject({
      errorCode: "CHEER_1202",
    });
  });

  it("관계를 포함한 3건 목록은 쿼리 1번이고 단건 읽음은 선행 조회 없이 쿼리 2번이다", async () => {
    // Given
    const receiverId = receiverIds[0];
    if (receiverId === undefined) {
      throw new Error("receiver fixture 누락");
    }
    await client.insert(cheer).values(
      Array.from({ length: 3 }, () => ({
        senderId,
        receiverId,
        message: "목록",
        createdAt: instantFromDate(SEED_AT),
      })),
    );
    const listStatements: string[] = [];
    const readStatements: string[] = [];

    // When
    recording = listStatements;
    const list = await context.module
      .get(CheerReaderPort)
      .listReceived({ userId: UserId.reconstitute(receiverId), afterCheerId: null, limit: 3 });
    recording = null;
    const first = list[0];
    if (first === undefined) {
      throw new Error("list fixture 누락");
    }
    recording = readStatements;
    await context.module
      .get(MarkCheerReadUseCase)
      .execute({ userId: receiverId, cheerId: first.id });
    recording = null;

    // Then
    expect(list).toHaveLength(3);
    expect(listStatements).toHaveLength(1);
    expect(readStatements).toHaveLength(2);
  });

  it("맞팔 판정은 쿼리 1번으로 양방향 수락·대기·누락·본인 팔로우 상태를 구분한다", async () => {
    // Given
    const receiverId = receiverIds[0];
    if (receiverId === undefined) {
      throw new Error("receiver fixture 누락");
    }
    const repository = context.module.get(FollowRepositoryPort);
    const isMutualFriend = (userId: string, targetUserId: string) =>
      repository.existsMutualFriendship(
        UserId.reconstitute(userId),
        UserId.reconstitute(targetUserId),
      );
    const statements: string[] = [];

    // When
    recording = statements;
    const accepted = await isMutualFriend(senderId, receiverId);
    recording = null;
    await client
      .update(follow)
      .set({ status: "PENDING" })
      .where(and(eq(follow.followerId, receiverId), eq(follow.followingId, senderId)));
    const pending = await isMutualFriend(senderId, receiverId);
    await client
      .delete(follow)
      .where(and(eq(follow.followerId, receiverId), eq(follow.followingId, senderId)));
    const missingReverse = await isMutualFriend(senderId, receiverId);
    await client.insert(follow).values({
      followerId: senderId,
      followingId: senderId,
      status: "ACCEPTED",
      sortOrder: 0,
      updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
    });
    const self = await isMutualFriend(senderId, senderId);
    const missingUser = await isMutualFriend(senderId, createEntityId());

    // Then
    expect({ accepted, pending, missingReverse, self, missingUser }).toEqual({
      accepted: true,
      pending: false,
      missingReverse: false,
      self: true,
      missingUser: false,
    });
    expect(statements).toHaveLength(1);
  });

  it("사용자 검색 count는 프로필 없음·태그·이름·유니코드·와일드카드에서 검색 결과 페이지와 일치한다", async () => {
    // Given
    const firstId = receiverIds[0];
    const deletedId = receiverIds[2];
    const inactiveId = receiverIds[3];
    if (firstId === undefined || deletedId === undefined || inactiveId === undefined) {
      throw new Error("검색 fixture 누락");
    }
    await client.insert(userProfile).values([
      { userId: firstId, name: "민서 가나다" },
      { userId: deletedId, name: "민서 가나다" },
      { userId: inactiveId, name: "민서 가나다" },
    ]);
    await client
      .update(userTable)
      .set({ deletedAt: instantFromDate(AT) })
      .where(eq(userTable.id, deletedId));
    await client.update(userTable).set({ status: "LOCKED" }).where(eq(userTable.id, inactiveId));
    const searchReader = context.module.get(FriendSearchReaderPort);

    // When
    const results = [];
    for (const { query, expected } of [
      { query: "SOCPG", expected: 2 },
      { query: "SOCPG001", expected: 1 },
      { query: "민서", expected: 1 },
      { query: "가나다".normalize("NFD"), expected: 1 },
      { query: "%", expected: 2 },
      { query: "_", expected: 2 },
      { query: "없는 이름", expected: 0 },
    ]) {
      const input = { viewerId: UserId.reconstitute(senderId), term: UserSearchTerm.create(query) };
      const [page, count] = await Promise.all([
        searchReader.searchUsers({ ...input, after: null, limit: 21 }),
        searchReader.countUsers(input),
      ]);
      results.push({ query, expected, page, count });
    }

    // Then
    for (const { query, expected, page, count } of results) {
      expect(count, query).toBe(expected);
      expect(page, query).toHaveLength(count);
      expect(
        page.every((item) => item.user.id !== deletedId && item.user.id !== inactiveId),
        query,
      ).toBe(true);
    }
  });
});
