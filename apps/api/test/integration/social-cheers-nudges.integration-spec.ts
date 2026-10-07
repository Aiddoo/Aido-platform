import type { SqlMiddleware } from "@prisma/orm-postgres/family-runtime";
import postgres from "@prisma/orm-postgres/runtime";
import { omit } from "es-toolkit";
import { Pool } from "pg";

import type { Contract } from "#api/generated/prisma8/contract.d";
import {
  CHEER_REPOSITORY,
  type CheerRepositoryPort,
} from "#api/modules/social/application/ports/cheers/cheer.repository.port";
import {
  FOLLOW_REPOSITORY,
  type FollowRepositoryPort,
} from "#api/modules/social/application/ports/friends/follow.repository.port";
import {
  NUDGE_REPOSITORY,
  type NudgeRepositoryPort,
} from "#api/modules/social/application/ports/nudges/nudge.repository.port";
import { MarkCheerRead } from "#api/modules/social/application/use-cases/cheers/mark-cheer-read.use-case";
import { SendCheer } from "#api/modules/social/application/use-cases/cheers/send-cheer.use-case";
import { SendNudge } from "#api/modules/social/application/use-cases/nudges/send-nudge.use-case";
import { normalizeUserSearchQuery } from "#api/modules/social/domain/policies/friends/user-search-query.policy";
import { encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { utcTimestampParameters } from "#api/platform/database/database-timestamp.middleware";
import { createEntityId } from "#api/platform/database/database-values";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";
import { UserFixture, TodoFixture, TodoCategoryFixture } from "#test/fixtures/index";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import contractJson from "../../src/generated/prisma8/contract.json" with { type: "json" };
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const AT = new Date("2027-01-04T20:00:00.000Z");
const SEED_AT = new Date("2027-01-04T19:00:00.000Z");
let recording: string[] | null = null;
const trace: SqlMiddleware = {
  name: "social-statement-observer",
  familyId: "sql",
  async afterQuery(plan, result) {
    if (recording !== null && result.source === "driver") recording.push(plan.sql);
  },
  async afterExecute(plan, result) {
    if (recording !== null && result.source === "driver") recording.push(plan.sql);
  },
};

describe("Social 일일 한도·쿨다운·native ORM (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let lockPool: Pool;
  let senderId: string;
  let receiverIds: string[];
  let todoIds: number[];
  beforeAll(async () => {
    database = new TestDatabase({
      createClient(url) {
        const pool = new Pool({ connectionString: url, max: 4 });
        const native = postgres<Contract>({
          contractJson,
          pg: pool,
          middleware: [utcTimestampParameters, trace],
        });
        let closed = false;
        return {
          ...native,
          async close() {
            if (closed) return;
            closed = true;
            await native.close();
            await pool.end();
          },
        };
      },
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
      await client.orm.public.User.create(encodeCreate("User", user));
      users.push(user.id);
    }
    senderId = users[0] ?? "";
    receiverIds = users.slice(1);
    todoIds = [];
    for (const [index, receiverId] of receiverIds.entries()) {
      await client.orm.public.Follow.createAndCount([
        encodeCreate("Follow", {
          followerId: senderId,
          followingId: receiverId,
          status: "ACCEPTED",
          sortOrder: index,
        }),
        encodeCreate("Follow", {
          followerId: receiverId,
          followingId: senderId,
          status: "ACCEPTED",
          sortOrder: 0,
        }),
      ]);
      const { id: categoryId } = await client.orm.public.TodoCategory.create(
        encodeCreate(
          "TodoCategory",
          TodoCategoryFixture.create({ userId: receiverId, sortOrder: 0 }),
        ),
      );
      const todo = TodoFixture.create({
        userId: receiverId,
        categoryId,
        visibility: "PUBLIC",
        startDate: new Date("2027-01-04"),
        endDate: new Date("2027-01-05"),
        sortOrder: 0,
      });
      const input = omit(todo, ["id"]);
      const row = await client.orm.public.Todo.create(encodeCreate("Todo", input));
      todoIds.push(row.id);
    }
  });
  afterEach(() => {
    recording = null;
    vi.useRealTimers();
  });
  afterAll(async () => {
    await lockPool?.end();
    if (context) await destroyE2eApp(context);
    else await database?.stop();
  });

  async function contend<T>(first: () => Promise<T>, second: () => Promise<T>) {
    const holding = await lockPool.connect();
    await holding.query("BEGIN");
    await holding.query('SELECT "id" FROM "User" WHERE "id"=$1 FOR UPDATE', [senderId]);
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
      const waiting = await client
        .runtime()
        .query(
          client.raw
            .sql`SELECT query FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' ORDER BY query`
            .returnsRow({ query: "pg/text@1" })
            .build(),
        );
      expect(waiting).toHaveLength(2);
    } finally {
      await holding.query("COMMIT");
      holding.release();
    }
    return outcomes;
  }
  async function seed(kind: "Cheer" | "Nudge") {
    for (let index = 0; index < 2; index++) {
      const receiverId = receiverIds[index];
      if (receiverId === undefined) throw new Error("receiver fixture 누락");
      if (kind === "Cheer")
        await client.orm.public.Cheer.create(
          encodeCreate("Cheer", { senderId, receiverId, message: null, createdAt: SEED_AT }),
        );
      else {
        const todoId = todoIds[index];
        if (todoId === undefined) throw new Error("todo fixture 누락");
        await client.orm.public.Nudge.create(
          encodeCreate("Nudge", {
            senderId,
            receiverId,
            todoId,
            message: null,
            createdAt: SEED_AT,
          }),
        );
      }
    }
  }
  async function usage(kind: "Cheer" | "Nudge") {
    const repo =
      kind === "Cheer"
        ? context.module.get<CheerRepositoryPort>(CHEER_REPOSITORY)
        : context.module.get<NudgeRepositoryPort>(NUDGE_REPOSITORY);
    return Promise.all(
      ["UTC", "Asia/Seoul"].map(async (tz) => {
        const window = dayWindowInTimezone(AT, tz);
        return {
          tz,
          localDate: window.localDate,
          startsAt: window.startsAt.toISOString(),
          endsAt: window.endsAt.toISOString(),
          used: await repo.countSentSince(senderId, window.startsAt, window.endsAt),
        };
      }),
    );
  }
  for (const kind of ["Cheer", "Nudge"] as const) {
    for (const mixedTimezone of [false, true]) {
      it(`${kind} 기존2회+동시2회는 ${mixedTimezone ? "서로 다른 localDate 시간대에서도" : "동일 시간대에서"} 일일3회만 허용해야 한다`, async () => {
        // Given - 기존 두 기록은 두 시간대의 날짜 범위에 모두 포함된다.
        await seed(kind);
        const before = await usage(kind);
        const execute = (index: number, tz: string) => {
          const receiverId = receiverIds[index];
          const todoId = todoIds[index];
          if (receiverId === undefined || todoId === undefined)
            throw new Error("요청 fixture 누락");
          return kind === "Cheer"
            ? context.module.get(SendCheer).execute({ senderId, receiverId, timezone: tz })
            : context.module.get(SendNudge).execute({ senderId, receiverId, todoId, timezone: tz });
        };
        // When
        const results = await contend(
          () => execute(2, "UTC"),
          () => execute(3, mixedTimezone ? "Asia/Seoul" : "UTC"),
        );
        const after = await usage(kind);
        const fulfilled = results.filter((result) => result.status === "fulfilled").length;
        console.log(
          "SOCIAL_AFTER_QUOTA",
          JSON.stringify({
            kind,
            mixedTimezone,
            before,
            after,
            fulfilled,
            rejected: results
              .filter((result) => result.status === "rejected")
              .map((result) => ({
                errorCode: result.reason?.errorCode,
                details: result.reason?.details,
              })),
          }),
        );
        // Then
        expect(fulfilled).toBe(1);
        expect(after.every((row) => row.used === 3)).toBe(true);
      });
    }
  }
  it("동일 친구 동시 Cheers는 다른 시간대에도 pair cooldown으로 하나만 허용한다", async () => {
    const receiverId = receiverIds[0];
    if (receiverId === undefined) throw new Error("receiver fixture 누락");
    const send = context.module.get(SendCheer);
    const results = await contend(
      () => send.execute({ senderId, receiverId, timezone: "UTC" }),
      () => send.execute({ senderId, receiverId, timezone: "Asia/Seoul" }),
    );
    console.log(
      "SOCIAL_AFTER_COOLDOWN",
      JSON.stringify({
        fulfilled: results.filter((result) => result.status === "fulfilled").length,
        rejected: results
          .filter((result) => result.status === "rejected")
          .map((result) => result.reason?.errorCode),
      }),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")?.reason).toMatchObject({
      errorCode: "CHEER_1202",
    });
  });
  it("관계 포함 3행 목록은 1 SQL이고 단건 읽음은 PK 선행 조회 없이 2 SQL이다", async () => {
    const receiverId = receiverIds[0];
    if (receiverId === undefined) throw new Error("receiver fixture 누락");
    for (let index = 0; index < 3; index++)
      await client.orm.public.Cheer.create(
        encodeCreate("Cheer", { senderId, receiverId, message: "목록", createdAt: SEED_AT }),
      );
    const listStatements: string[] = [];
    recording = listStatements;
    const list = await context.module
      .get<CheerRepositoryPort>(CHEER_REPOSITORY)
      .findReceivedCheers({ userId: receiverId, size: 3 });
    recording = null;
    const first = list[0];
    if (first === undefined) throw new Error("list fixture 누락");
    const readStatements: string[] = [];
    recording = readStatements;
    await context.module.get(MarkCheerRead).execute({ userId: receiverId, cheerId: first.id });
    recording = null;
    for (const [scenario, statements] of [
      ["list-3-with-profile", listStatements],
      ["mark-one-as-read", readStatements],
    ] as const)
      console.log(
        "SOCIAL_AFTER_QUERY",
        JSON.stringify({
          scenario,
          count: statements.length,
          fixtureRows: 3,
          transactionControlsAndFixtureExcluded: true,
        }),
      );
    expect(list).toHaveLength(3);
    expect(listStatements).toHaveLength(1);
    expect(readStatements).toHaveLength(2);
  });
  it("맞팔 판정은 한 SQL로 양방향 ACCEPTED·PENDING·누락·기존 self 상태를 구분한다", async () => {
    // Given
    const receiverId = receiverIds[0];
    if (receiverId === undefined) throw new Error("receiver fixture 누락");
    const repository = context.module.get<FollowRepositoryPort>(FOLLOW_REPOSITORY);
    const statements: string[] = [];
    recording = statements;
    // When
    const accepted = await repository.isMutualFriend(senderId, receiverId);
    recording = null;
    await client.orm.public.Follow.where({
      followerId: receiverId,
      followingId: senderId,
    }).updateAndCount({ status: "PENDING" });
    const pending = await repository.isMutualFriend(senderId, receiverId);
    await client.orm.public.Follow.where({
      followerId: receiverId,
      followingId: senderId,
    }).deleteAndCount();
    const missingReverse = await repository.isMutualFriend(senderId, receiverId);
    await client.orm.public.Follow.create(
      encodeCreate("Follow", {
        followerId: senderId,
        followingId: senderId,
        status: "ACCEPTED",
        sortOrder: 0,
      }),
    );
    const self = await repository.isMutualFriend(senderId, senderId);
    const missingUser = await repository.isMutualFriend(senderId, createEntityId());
    // Then
    expect({ accepted, pending, missingReverse, self, missingUser }).toEqual({
      accepted: true,
      pending: false,
      missingReverse: false,
      self: true,
      missingUser: false,
    });
    console.log(
      "SOCIAL_AFTER_QUERY",
      JSON.stringify({
        scenario: "mutual-friend",
        count: statements.length,
        transactionControlsAndFixtureExcluded: true,
      }),
    );
    expect(statements).toHaveLength(1);
  });

  it("native ORM 검색 count는 nullable profile·태그·이름·Unicode·wildcard에서 기존 ranked page와 일치한다", async () => {
    // Given
    const firstId = receiverIds[0];
    const deletedId = receiverIds[2];
    const inactiveId = receiverIds[3];
    if (firstId === undefined || deletedId === undefined || inactiveId === undefined)
      throw new Error("검색 fixture 누락");
    await client.orm.public.UserProfile.createAndCount([
      encodeCreate("UserProfile", { userId: firstId, name: "민서 가나다" }),
      encodeCreate("UserProfile", { userId: deletedId, name: "민서 가나다" }),
      encodeCreate("UserProfile", { userId: inactiveId, name: "민서 가나다" }),
    ]);
    await client.orm.public.User.where({ id: deletedId }).updateAndCount(
      encodePatch("User", { deletedAt: AT }),
    );
    await client.orm.public.User.where({ id: inactiveId }).updateAndCount({ status: "LOCKED" });
    const repository = context.module.get<FollowRepositoryPort>(FOLLOW_REPOSITORY);
    // When / Then
    for (const { query, expected } of [
      { query: "SOCPG", expected: 2 },
      { query: "SOCPG001", expected: 1 },
      { query: "민서", expected: 1 },
      { query: "가나다".normalize("NFD"), expected: 1 },
      { query: "%", expected: 2 },
      { query: "_", expected: 2 },
      { query: "없는 이름", expected: 0 },
    ]) {
      const normalized = normalizeUserSearchQuery(query);
      const input = {
        viewerId: senderId,
        nfcQuery: normalized.nfc,
        upperTag: normalized.upperTag,
        size: 20,
      };
      const [page, count] = await Promise.all([
        repository.searchUsers(input),
        repository.countSearchUsers(input),
      ]);
      expect(count, query).toBe(expected);
      expect(page, query).toHaveLength(count);
      expect(
        page.every((item) => item.id !== deletedId && item.id !== inactiveId),
        query,
      ).toBe(true);
    }
  });

  it("native updateAll은 실제 수정 상태와 nullable profile 관계를 반환한다", async () => {
    // Given
    const receiverId = receiverIds[0];
    if (receiverId === undefined) throw new Error("receiver fixture 누락");
    const row = await client.orm.public.Follow.where({
      followerId: senderId,
      followingId: receiverId,
    })
      .select("id")
      .first();
    if (row === null) throw new Error("follow fixture 누락");
    const repository = context.module.get<FollowRepositoryPort>(FOLLOW_REPOSITORY);
    // When
    const updated = await repository.update(row.id, { status: "PENDING", sortOrder: 4 });
    const reciprocal = await repository.updateByFollowerAndFollowing(senderId, receiverId, {
      status: "ACCEPTED",
      sortOrder: 0,
    });
    const projection = await repository.updateFollowSortOrder(row.id, 2);
    // Then
    expect(updated.isPending()).toBe(true);
    expect(updated.sortOrder).toBe(4);
    expect(reciprocal.isAccepted()).toBe(true);
    expect(reciprocal.sortOrder).toBe(0);
    expect(projection).toMatchObject({
      sortOrder: 2,
      follower: { id: senderId, profile: null },
      following: { id: receiverId, profile: null },
    });
  });
});
