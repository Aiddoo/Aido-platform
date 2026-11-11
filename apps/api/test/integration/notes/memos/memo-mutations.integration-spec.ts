import { ErrorCode } from "@aido/api/errors";
import { MEMO_LIMITS } from "@aido/api/vocabulary";
import { eq, sql } from "drizzle-orm";
import { omit } from "es-toolkit";
import { Pool } from "pg";

import { MemoLockKeys } from "#api/modules/notes/memos/application/memos.lock-keys";
import { MemoRepositoryPort } from "#api/modules/notes/memos/application/ports/memo.repository.port";
import { ConvertMemoToTodosUseCase } from "#api/modules/notes/memos/application/use-cases/convert-memo-to-todos.use-case";
import { CreateMemoUseCase } from "#api/modules/notes/memos/application/use-cases/create-memo.use-case";
import { ReorderMemoUseCase } from "#api/modules/notes/memos/application/use-cases/reorder-memo.use-case";
import { SetMemoPinnedUseCase } from "#api/modules/notes/memos/application/use-cases/set-memo-pinned.use-case";
import { UpdateMemoUseCase } from "#api/modules/notes/memos/application/use-cases/update-memo.use-case";
import { MemoId } from "#api/modules/notes/memos/domain/memo-id.vo";
import { TodoCategoryId } from "#api/modules/planning/categories/planning-categories.public";
import {
  DatabaseRecordNotFoundError,
  databaseSqlState,
  requireRecord,
} from "#api/platform/database/database-error.util";
import { memo, todoCategory, todoItem, user } from "#api/platform/database/schema/index";
import { DomainEventPublisherPort } from "#api/shared/application/ports/domain-event-publisher.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { TodoCategoryFixture, UserFixture } from "#test/fixtures/index";
import { createMemoFixture } from "#test/fixtures/notes/memo.fixture";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../../../e2e/helpers/e2e-app-factory.js";

const AT = Temporal.Instant.from("2027-01-08T12:00:00Z");

function statementSummary(statements: readonly string[]) {
  const business = statements.filter(
    (statement) => !/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET)\b/i.test(statement.trim()),
  );
  const mutationLocks = business.filter((statement) =>
    statement.includes("pg_advisory_xact_lock"),
  ).length;
  const rangeUpdates = business.filter((statement) => statement.includes('"sortOrder" +')).length;
  return {
    total: business.length,
    queries: business.length - mutationLocks - rangeUpdates,
    mutationLocks,
    rangeUpdates,
  };
}

describe("메모 변경 원자성 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let lockPool: Pool;
  let userId: string;
  let otherUserId: string;
  let repository: MemoRepositoryPort;
  let recording: string[] | null = null;

  beforeAll(async () => {
    database = new TestDatabase({
      createClient: (url) =>
        createTestClient(url, { max: 5 }, (statement) => {
          if (recording !== null) {
            recording.push(statement);
          }
        }),
    });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    lockPool = new Pool({ connectionString: database.getConnectionUri(), max: 1 });
    repository = context.module.get(MemoRepositoryPort);
  });

  beforeEach(async () => {
    recording = null;
    await context.reset();
    const owner = UserFixture.create();
    const other = UserFixture.create();
    await client.insert(user).values([owner, other]);
    userId = owner.id;
    otherUserId = other.id;
  });

  afterEach(() => {
    recording = null;
  });

  afterAll(async () => {
    await lockPool?.end();
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  async function seedMemo(sortOrder = 0, ownerId = userId) {
    const row = omit(
      createMemoFixture({
        userId: ownerId,
        content: `메모 ${sortOrder}`,
        sortOrder,
        createdAt: AT,
        updatedAt: AT,
      }).toPrimitives(),
      ["id"],
    );
    const [created] = await client.insert(memo).values(row).returning();
    return requireRecord(created);
  }

  async function seedMemos(count: number) {
    const rows = [];
    for (let index = 0; index < count; index++) {
      rows.push(await seedMemo(index));
    }
    return rows;
  }

  async function holdListLock() {
    const connection = await lockPool.connect();
    await connection.query("BEGIN");
    await connection.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      MemoLockKeys.sortOrder(UserId.reconstitute(userId)),
    ]);
    return async () => {
      try {
        await connection.query("COMMIT");
      } finally {
        connection.release();
      }
    };
  }

  async function countLockWaiters() {
    const waiting = await client.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE datname=current_database() AND wait_event_type='Lock'
        AND query LIKE '%pg_advisory_xact_lock%'
    `);
    return waiting.rows.at(0)?.count ?? 0;
  }

  async function waitForBlockedRequests(count: number) {
    await vi.waitFor(
      async () => {
        expect(await countLockWaiters()).toBe(count);
      },
      { timeout: 5000, interval: 10 },
    );
  }

  async function contend<T>(first: () => Promise<T>, second: () => Promise<T>) {
    const release = await holdListLock();
    const outcomes = Promise.allSettled([first(), second()]);
    try {
      await waitForBlockedRequests(2);
    } finally {
      await release();
      await outcomes;
    }
    return outcomes;
  }

  it("메모 19개에서 동시 생성은 한 요청만 성공하고 최대 개수·고유 순서를 지킨다", async () => {
    // Given
    await seedMemos(MEMO_LIMITS.MAX_PER_USER - 1);
    const create = context.module.get(CreateMemoUseCase);

    // When
    const outcomes = await contend(
      () => create.execute({ userId, content: "첫 번째 새 메모" }),
      () => create.execute({ userId, content: "두 번째 새 메모" }),
    );
    const rows = await client
      .select({ sortOrder: memo.sortOrder })
      .from(memo)
      .where(eq(memo.userId, userId));

    // Then
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((outcome) => outcome.status === "rejected")?.reason).toMatchObject({
      errorCode: ErrorCode.MEMO_2003,
      details: { current: 20, limit: 20 },
    });
    expect(rows).toHaveLength(MEMO_LIMITS.MAX_PER_USER);
    expect(new Set(rows.map((row) => row.sortOrder)).size).toBe(rows.length);
  });

  it("동일 메모를 동일 위치로 동시 재정렬해도 두 요청 이후 순서가 중복되지 않는다", async () => {
    // Given
    const rows = await seedMemos(3);
    const source = rows.at(0);
    const target = rows.at(2);
    if (source === undefined || target === undefined) {
      throw new Error("메모 fixture 누락");
    }
    const reorder = context.module.get(ReorderMemoUseCase);
    const command = {
      userId,
      memoId: source.id,
      targetMemoId: target.id,
      position: "after",
    } satisfies Parameters<ReorderMemoUseCase["execute"]>[0];

    // When
    const outcomes = await contend(
      () => reorder.execute(command),
      () => reorder.execute(command),
    );
    const saved = await client.query.memo.findMany({
      columns: { id: true, sortOrder: true },
      where: { userId },
      orderBy: { id: "asc" },
    });

    // Then
    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    expect(saved.map((row) => row.sortOrder)).toEqual([2, 0, 1]);
  });

  it("같은 메모의 재정렬·내용 수정·고정이 동시에 와도 어느 변경도 잃지 않고 순서가 이어진다", async () => {
    // Given
    const rows = await seedMemos(3);
    const [source, middle, target] = rows;
    if (source === undefined || middle === undefined || target === undefined) {
      throw new Error("메모 fixture 누락");
    }
    const requestCount = 3;
    let sourceReads = 0;
    const findMemo = repository.findByIdAndUserId.bind(repository);
    // 모든 요청이 같은 메모를 읽었거나 잠금을 기다릴 때까지 쓰기를 미뤄, 읽고 쓰는 사이에 다른 요청이 끼어들게 한다
    vi.spyOn(repository, "findByIdAndUserId").mockImplementation(async (memoId, owner) => {
      const found = await findMemo(memoId, owner);
      if (memoId.value === source.id) {
        sourceReads += 1;
        await vi.waitFor(
          async () => {
            expect(sourceReads + (await countLockWaiters())).toBeGreaterThanOrEqual(requestCount);
          },
          { timeout: 5000, interval: 10 },
        );
      }
      return found;
    });

    // When
    const outcomes = await Promise.allSettled([
      context.module
        .get(ReorderMemoUseCase)
        .execute({ userId, memoId: source.id, targetMemoId: target.id, position: "after" }),
      context.module
        .get(UpdateMemoUseCase)
        .execute({ userId, memoId: source.id, content: "동시에 고친 내용" }),
      context.module
        .get(SetMemoPinnedUseCase)
        .execute({ userId, memoId: source.id, isPinned: true }),
    ]);
    const saved = await client.query.memo.findMany({
      columns: { id: true, content: true, isPinned: true, sortOrder: true },
      where: { userId },
      orderBy: { id: "asc" },
    });

    // Then
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      "fulfilled",
      "fulfilled",
      "fulfilled",
    ]);
    expect(saved).toEqual([
      { id: source.id, content: "동시에 고친 내용", isPinned: true, sortOrder: 2 },
      { id: middle.id, content: "메모 1", isPinned: false, sortOrder: 0 },
      { id: target.id, content: "메모 2", isPinned: false, sortOrder: 1 },
    ]);
  });

  it("한 사용자의 목록 잠금은 다른 사용자의 메모 생성을 막지 않는다", async () => {
    // Given
    const create = context.module.get(CreateMemoUseCase);
    const release = await holdListLock();
    const blocked = create.execute({ userId, content: "대기 중 메모" });

    // When
    try {
      await waitForBlockedRequests(1);
      const created = await create.execute({ userId: otherUserId, content: "다른 사용자 메모" });

      // Then
      expect(created.toPrimitives()).toMatchObject({
        userId: otherUserId,
        content: "다른 사용자 메모",
      });
      await waitForBlockedRequests(1);
    } finally {
      await release();
      await blocked;
    }
  });

  it("자기 메모를 기준으로 한 재정렬은 순서·수정 시각을 쓰지 않는다", async () => {
    // Given
    const row = await seedMemo(4);

    // When
    const reordered = await context.module
      .get(ReorderMemoUseCase)
      .execute({ userId, memoId: row.id, targetMemoId: row.id, position: "before" });

    // Then
    expect(reordered.toPrimitives()).toMatchObject({ sortOrder: 4, updatedAt: AT });
    expect(
      await client.query.memo.findFirst({
        columns: { sortOrder: true, updatedAt: true },
        where: { id: row.id },
      }),
    ).toEqual({ sortOrder: 4, updatedAt: AT });
  });

  it("타인 메모는 수정하거나 재정렬 기준으로 쓸 수 없다", async () => {
    // Given
    const own = await seedMemo();
    const foreign = await seedMemo(1, otherUserId);

    // When & Then: 거부 처리기를 만들 때 바로 걸어 먼저 끝난 거부가 처리되지 않은 채 남지 않게 한다
    await expect(
      context.module
        .get(UpdateMemoUseCase)
        .execute({ userId, memoId: foreign.id, content: "덮어쓰기" }),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.MEMO_2001,
      details: { memoId: foreign.id },
    });
    await expect(
      context.module
        .get(ReorderMemoUseCase)
        .execute({ userId, memoId: own.id, targetMemoId: foreign.id, position: "after" }),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.MEMO_2002,
      details: { targetMemoId: foreign.id },
    });
    expect(
      await client.query.memo.findFirst({
        columns: { content: true, sortOrder: true },
        where: { id: foreign.id },
      }),
    ).toEqual({ content: "메모 1", sortOrder: 1 });
  });

  it("같은 UoW에서 순서를 민 뒤 지울 메모가 없으면 민 순서도 rollback한다", async () => {
    // Given
    await seedMemos(3);
    const before = await client.query.memo.findMany({
      columns: { id: true, sortOrder: true },
      where: { userId },
      orderBy: { id: "asc" },
    });
    const missing = createMemoFixture({ id: 2_147_483_647, userId });

    // When
    const result = context.module.get(UnitOfWorkPort).run(async () => {
      await repository.shiftSortOrders(
        UserId.reconstitute(userId),
        { fromSortOrder: 1, toSortOrder: 2, delta: -1 },
        AT.add({ seconds: 5 }),
      );
      await repository.delete(missing);
    });

    // Then
    await expect(result).rejects.toBeInstanceOf(DatabaseRecordNotFoundError);
    expect(
      await client.query.memo.findMany({
        columns: { id: true, sortOrder: true },
        where: { userId },
        orderBy: { id: "asc" },
      }),
    ).toEqual(before);
  });

  it("세 메모의 수정·조회·재정렬은 실제 잠금을 포함한 SQL 예산을 지킨다", async () => {
    // Given
    const rows = await seedMemos(3);
    const source = rows.at(0);
    const target = rows.at(2);
    if (source === undefined || target === undefined) {
      throw new Error("메모 fixture 누락");
    }
    const owner = UserId.reconstitute(userId);
    const measures = [];
    const actions = [
      {
        name: "update-content",
        run: () =>
          context.module
            .get(UpdateMemoUseCase)
            .execute({ userId, memoId: source.id, content: "변경된 내용" }),
        expected: { total: 3, queries: 2, mutationLocks: 1, rangeUpdates: 0 },
      },
      {
        name: "list-no-cursor",
        run: () => repository.listByUserId({ userId: owner, afterMemoId: null, limit: 4 }),
        expected: { total: 1, queries: 1, mutationLocks: 0, rangeUpdates: 0 },
      },
      {
        name: "list-own-cursor",
        run: () =>
          repository.listByUserId({
            userId: owner,
            afterMemoId: MemoId.reconstitute(target.id),
            limit: 4,
          }),
        expected: { total: 2, queries: 2, mutationLocks: 0, rangeUpdates: 0 },
      },
      {
        name: "reorder-relative",
        run: () =>
          context.module
            .get(ReorderMemoUseCase)
            .execute({ userId, memoId: source.id, targetMemoId: target.id, position: "after" }),
        expected: { total: 5, queries: 3, mutationLocks: 1, rangeUpdates: 1 },
      },
    ];

    // When
    for (const action of actions) {
      recording = [];
      await action.run();
      const measured = statementSummary(recording);
      recording = null;
      measures.push({ name: action.name, ...measured });

      // Then
      expect(measured).toEqual(action.expected);
    }
    process.stdout.write(`NOTES_SQL_AFTER ${JSON.stringify(measures)}\n`);
  });

  it("반복 규칙 저장이 실패하면 해당 항목만 rollback하고 이전 성공·메모를 보존한다", async () => {
    // Given
    const seeded = await seedMemo();
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
      .returning();
    const categoryId = requireRecord(category).id;
    const publish = vi.spyOn(context.module.get(DomainEventPublisherPort), "publish");
    const startDate = Temporal.PlainDate.from("2027-01-08");

    // When
    recording = [];
    const failure: unknown = await context.module
      .get(ConvertMemoToTodosUseCase)
      .execute({
        userId,
        memoId: seeded.id,
        timezone: "UTC",
        todos: [
          {
            title: "앞선 성공 항목",
            categoryId: TodoCategoryId.reconstitute(categoryId),
            startDate,
          },
          {
            title: "실패 반복 항목",
            categoryId: TodoCategoryId.reconstitute(categoryId),
            startDate,
            repeat: {
              frequency: "WEEKLY",
              interval: 1,
              weekdays: ["FRI", "SAT"],
              end: { type: "UNTIL", date: "2027-01-09" },
            },
            items: [{ title: "저장 불가능\u0000item" }],
          },
        ],
      })
      .catch((error: unknown) => error);
    const writes = recording;
    recording = null;

    // Then
    expect(failure).toBeInstanceOf(Error);
    // 체크리스트 템플릿(jsonb)이 NUL을 거부해 회차 INSERT 전에 실패한다.
    expect(databaseSqlState(failure)).toBe("22P05");
    expect(writes.filter((statement) => statement.includes('insert into "Todo"'))).toHaveLength(1);
    expect(
      writes.filter((statement) => statement.includes('insert into "TodoSeries"')),
    ).toHaveLength(1);
    const todos = await client.query.todo.findMany({
      columns: { id: true, title: true, seriesId: true },
      where: { userId },
    });
    expect(todos).toHaveLength(1);
    expect(todos.at(0)).toMatchObject({ title: "앞선 성공 항목", seriesId: null });
    expect(await client.$count(todoItem)).toBe(0);
    expect(
      await repository.findByIdAndUserId(
        MemoId.reconstitute(seeded.id),
        UserId.reconstitute(userId),
      ),
    ).not.toBeNull();
    const created = publish.mock.calls
      .flatMap(([published]) => published)
      .filter((event) => event.eventName === "planning.todo.created")
      .map((event) => event.toPayload());
    expect(created).toEqual([expect.objectContaining({ todoId: todos.at(0)?.id })]);
  });
});
