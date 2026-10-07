import { ErrorCode } from "@aido/api/errors";
import { MEMO_LIMITS } from "@aido/api/vocabulary";
import type { SqlMiddleware } from "@prisma/orm-postgres/family-runtime";
import postgres from "@prisma/orm-postgres/runtime";
import { omit } from "es-toolkit";
import { Pool } from "pg";

import type { Contract } from "#api/generated/prisma8/contract.d";
import {
  MEMO_REPOSITORY,
  type MemoRepositoryPort,
} from "#api/modules/notes/application/ports/memos/memo.repository.port";
import { ConvertMemoToTodos } from "#api/modules/notes/application/use-cases/memos/convert-memo-to-todos.use-case";
import { CreateMemo } from "#api/modules/notes/application/use-cases/memos/create-memo.use-case";
import { ReorderMemo } from "#api/modules/notes/application/use-cases/memos/reorder-memo.use-case";
import { UpdateMemo } from "#api/modules/notes/application/use-cases/memos/update-memo.use-case";
import { TodoCreatedEvent } from "#api/modules/planning/domain/events/todos/todo-created.event";
import { encodeCreate } from "#api/platform/database/database-records";
import { utcTimestampParameters } from "#api/platform/database/database-timestamp.middleware";
import {
  DatabaseRecordNotFoundError,
  databaseSqlState,
} from "#api/platform/database/prisma-error.util";
import {
  DOMAIN_EVENT_PUBLISHER,
  UNIT_OF_WORK,
  MutationLockKeys,
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { MemoBuilder } from "#test/builders/memo.builder";
import { UserFixture, TodoCategoryFixture } from "#test/fixtures/index";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import contractJson from "../../src/generated/prisma8/contract.json" with { type: "json" };
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const AT = new Date("2027-01-08T12:00:00.000Z");

function statementSummary(statements: readonly string[]) {
  const business = statements.filter(
    (sql) => !/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET)\b/i.test(sql.trim()),
  );
  const mutationLocks = business.filter((sql) => sql.includes("pg_advisory_xact_lock")).length;
  const rangeUpdates = business.filter((sql) => sql.includes('"sortOrder" +')).length;
  return {
    total: business.length,
    nativeOrm: business.length - mutationLocks - rangeUpdates,
    mutationLocks,
    rangeUpdates,
  };
}

describe("메모 변경 원자성·native ORM (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let lockPool: Pool;
  let userId: string;
  let otherUserId: string;
  let repository: MemoRepositoryPort;
  let recording: string[] | null = null;

  beforeAll(async () => {
    const trace: SqlMiddleware = {
      name: "notes-statement-observer",
      familyId: "sql",
      async afterQuery(plan, result) {
        if (recording !== null && result.source === "driver") recording.push(plan.sql);
      },
      async afterExecute(plan, result) {
        if (recording !== null && result.source === "driver") recording.push(plan.sql);
      },
    };
    database = new TestDatabase({
      createClient(url) {
        const pool = new Pool({ connectionString: url, max: 5 });
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
    repository = context.module.get<MemoRepositoryPort>(MEMO_REPOSITORY);
  });

  beforeEach(async () => {
    recording = null;
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const owner = UserFixture.create();
    const other = UserFixture.create();
    await client.orm.public.User.create(encodeCreate("User", owner));
    await client.orm.public.User.create(encodeCreate("User", other));
    userId = owner.id;
    otherUserId = other.id;
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

  async function seedMemo(sortOrder = 0, ownerId = userId) {
    const record = MemoBuilder.create(ownerId)
      .withContent(`메모 ${sortOrder}`)
      .withSortOrder(sortOrder)
      .withCreatedAt(new Date(AT))
      .build();
    record.updatedAt = new Date(AT);
    return client.orm.public.Memo.create(encodeCreate("Memo", omit(record, ["id"])));
  }

  async function seedMemos(count: number) {
    const rows = [];
    for (let index = 0; index < count; index++) rows.push(await seedMemo(index));
    return rows;
  }

  async function holdListLock() {
    const connection = await lockPool.connect();
    await connection.query("BEGIN");
    await connection.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      MutationLockKeys.memoSortOrder(userId),
    ]);
    return async () => {
      try {
        await connection.query("COMMIT");
      } finally {
        connection.release();
      }
    };
  }

  async function waitForBlockedRequests(count: number) {
    await vi.waitFor(
      async () => {
        const rows = await client.runtime().query(
          client.raw.sql`
            SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname=current_database() AND wait_event_type='Lock'
              AND query LIKE '%pg_advisory_xact_lock%'
          `
            .returnsRow({ count: "pg/int4@1" })
            .build(),
        );
        expect(rows.at(0)?.count).toBe(count);
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
    const create = context.module.get(CreateMemo);

    // When
    const outcomes = await contend(
      () => create.execute({ userId, content: "첫 번째 새 메모" }),
      () => create.execute({ userId, content: "두 번째 새 메모" }),
    );
    const rows = await client.orm.public.Memo.where({ userId }).select("sortOrder").all();

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
    if (source === undefined || target === undefined) throw new Error("메모 fixture 누락");
    const reorder = context.module.get(ReorderMemo);
    const input = {
      userId,
      memoId: source.id,
      targetMemoId: target.id,
      position: "after",
    } satisfies Parameters<ReorderMemo["execute"]>[0];

    // When
    const outcomes = await contend(
      () => reorder.execute(input),
      () => reorder.execute(input),
    );
    const saved = await client.orm.public.Memo.where({ userId })
      .select("id", "sortOrder")
      .orderBy((row) => row.id.asc())
      .all();

    // Then
    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    expect(saved.map((row) => row.sortOrder)).toEqual([2, 0, 1]);
    expect(new Set(saved.map((row) => row.sortOrder)).size).toBe(3);
  });

  it("한 사용자의 목록 잠금은 다른 사용자의 메모 생성을 막지 않는다", async () => {
    // Given
    const create = context.module.get(CreateMemo);
    const release = await holdListLock();
    const blocked = create.execute({ userId, content: "대기 중 메모" });

    // When
    try {
      await waitForBlockedRequests(1);
      const response = await create.execute({ userId: otherUserId, content: "다른 사용자 메모" });
      // Then
      expect(response.memo).toMatchObject({ userId: otherUserId, content: "다른 사용자 메모" });
      await waitForBlockedRequests(1);
    } finally {
      await release();
      await blocked;
    }
  });

  it("자기 메모를 기준으로 한 재정렬은 날짜·순서를 쓰지 않는다", async () => {
    // Given
    const row = await seedMemo(4);
    vi.setSystemTime(new Date(AT.getTime() + 5000));

    // When
    const response = await context.module
      .get(ReorderMemo)
      .execute({ userId, memoId: row.id, targetMemoId: row.id, position: "before" });

    // Then
    expect(response.memo).toMatchObject({ sortOrder: 4, updatedAt: AT.toISOString() });
    expect(
      await client.orm.public.Memo.where({ id: row.id }).select("sortOrder", "updatedAt").first(),
    ).toMatchObject({ sortOrder: 4 });
  });

  it("타인 메모는 수정하거나 재정렬 대상으로 사용할 수 없다", async () => {
    // Given
    const own = await seedMemo();
    const foreign = await seedMemo(1, otherUserId);

    // When / Then
    await expect(
      context.module.get(UpdateMemo).execute({ userId, memoId: foreign.id, content: "덮어쓰기" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.MEMO_2001, details: { memoId: foreign.id } });
    await expect(
      context.module
        .get(ReorderMemo)
        .execute({ userId, memoId: own.id, targetMemoId: foreign.id, position: "after" }),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.MEMO_2002,
      details: { targetMemoId: foreign.id },
    });
    expect(
      await client.orm.public.Memo.where({ id: foreign.id }).select("content", "sortOrder").first(),
    ).toEqual({ content: "메모 1", sortOrder: 1 });
  });

  it("재정렬 도중 대상 행이 없으면 앞서 이동한 순서도 rollback한다", async () => {
    // Given
    await seedMemos(3);
    const before = await client.orm.public.Memo.where({ userId })
      .select("id", "sortOrder")
      .orderBy((row) => row.id.asc())
      .all();
    const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);

    // When / Then
    await expect(
      unitOfWork.run(async () => {
        await repository.shiftSortOrders(userId, 1, 2, -1);
        await repository.updateSortOrder(2147483647, 2);
      }),
    ).rejects.toBeInstanceOf(DatabaseRecordNotFoundError);
    expect(
      await client.orm.public.Memo.where({ userId })
        .select("id", "sortOrder")
        .orderBy((row) => row.id.asc())
        .all(),
    ).toEqual(before);
  });

  it("고정 우선·정렬·커서 계약을 유지하고 없는 커서와 타인 커서는 빈 페이지로 처리한다", async () => {
    // Given
    const rows = await seedMemos(3);
    const pinned = rows.at(0);
    const last = rows.at(2);
    const middle = rows.at(1);
    if (pinned === undefined || last === undefined || middle === undefined)
      throw new Error("메모 fixture 누락");
    await repository.updatePinned(pinned.id, true);
    const tied = await seedMemo(2);
    const foreign = await seedMemo(1, otherUserId);

    // When
    const firstPage = await repository.findManyByUserId({ userId, size: 1 });
    const nextPage = await repository.findManyByUserId({ userId, cursor: pinned.id, size: 2 });

    // Then
    expect(firstPage.map((row) => row.id)).toEqual([pinned.id, tied.id]);
    expect(nextPage.map((row) => row.id)).toEqual([tied.id, last.id, middle.id]);
    expect(
      (await repository.findManyByUserId({ userId, cursor: tied.id, size: 2 })).map(
        (row) => row.id,
      ),
    ).toEqual([last.id, middle.id]);
    expect(await repository.findManyByUserId({ userId, cursor: 2147483647, size: 2 })).toEqual([]);
    expect(await repository.findManyByUserId({ userId, cursor: foreign.id, size: 2 })).toEqual([]);
  });

  it("native 갱신·삭제에 행이 없으면 기존 not-found 예외를 유지한다", async () => {
    // Given
    const missingId = 2147483647;

    // When / Then
    await expect(repository.updateContent(missingId, "내용")).rejects.toBeInstanceOf(
      DatabaseRecordNotFoundError,
    );
    await expect(repository.updatePinned(missingId, false)).rejects.toBeInstanceOf(
      DatabaseRecordNotFoundError,
    );
    await expect(repository.updateSortOrder(missingId, 0)).rejects.toBeInstanceOf(
      DatabaseRecordNotFoundError,
    );
    await expect(repository.delete(missingId)).rejects.toBeInstanceOf(DatabaseRecordNotFoundError);
  });

  it("native 갱신의 UTC 날짜와 false·0·기존 생성 시각을 정확히 보존한다", async () => {
    // Given
    const row = await seedMemo(4);
    await repository.updatePinned(row.id, true);
    const updatedAt = new Date(AT.getTime() + 5000);
    vi.setSystemTime(updatedAt);

    // When
    const content = await repository.updateContent(row.id, "새 내용");
    const unpinned = await repository.updatePinned(row.id, false);
    const reordered = await repository.updateSortOrder(row.id, 0);

    // Then
    expect(content.snapshot).toMatchObject({ content: "새 내용", createdAt: AT, updatedAt });
    expect(unpinned.isPinned).toBe(false);
    expect(reordered.snapshot).toMatchObject({
      sortOrder: 0,
      isPinned: false,
      createdAt: AT,
      updatedAt,
    });
  });

  it("동일 3메모의 수정·조회·재정렬은 실제 잠금을 포함한 SQL 예산을 지킨다", async () => {
    // Given
    const rows = await seedMemos(3);
    const source = rows.at(0);
    const target = rows.at(2);
    if (source === undefined || target === undefined) throw new Error("메모 fixture 누락");
    const measures = [];
    const actions = [
      {
        name: "update-content",
        run: () =>
          context.module
            .get(UpdateMemo)
            .execute({ userId, memoId: source.id, content: "변경된 내용" }),
        expected: { total: 3, nativeOrm: 2, mutationLocks: 1, rangeUpdates: 0 },
      },
      {
        name: "list-no-cursor",
        run: () => repository.findManyByUserId({ userId, size: 3 }),
        expected: { total: 1, nativeOrm: 1, mutationLocks: 0, rangeUpdates: 0 },
      },
      {
        name: "list-own-cursor",
        run: () => repository.findManyByUserId({ userId, cursor: target.id, size: 3 }),
        expected: { total: 2, nativeOrm: 2, mutationLocks: 0, rangeUpdates: 0 },
      },
      {
        name: "reorder-relative",
        run: () =>
          context.module
            .get(ReorderMemo)
            .execute({ userId, memoId: source.id, targetMemoId: target.id, position: "after" }),
        expected: { total: 5, nativeOrm: 3, mutationLocks: 1, rangeUpdates: 1 },
      },
    ];
    // When / Then
    for (const action of actions) {
      recording = [];
      await action.run();
      const measured = statementSummary(recording);
      recording = null;
      measures.push({ name: action.name, ...measured });
      expect(measured).toEqual(action.expected);
    }
    process.stdout.write(`NOTES_SQL_AFTER ${JSON.stringify(measures)}\n`);
  });

  it("반복 부모 생성 후 item 저장이 실패하면 해당 항목만 rollback하고 이전 성공·메모를 보존한다", async () => {
    // Given
    const memo = await seedMemo();
    const category = await client.orm.public.TodoCategory.create(
      encodeCreate(
        "TodoCategory",
        omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]),
      ),
    );
    const publisher = context.module.get<DomainEventPublisherPort>(DOMAIN_EVENT_PUBLISHER);
    const publishAll = vi.spyOn(publisher, "publishAll");

    // When
    recording = [];
    const failure: unknown = await context.module
      .get(ConvertMemoToTodos)
      .execute({
        userId,
        memoId: memo.id,
        timezone: "UTC",
        data: {
          todos: [
            { title: "앞선 성공 항목", categoryId: category.id, startDate: AT },
            {
              title: "실패 반복 항목",
              categoryId: category.id,
              startDate: AT,
              isRecurring: true,
              recurrence: { daysOfWeek: ["FRI", "SAT"], endDate: new Date("2027-01-09") },
              items: [{ title: "저장 불가능\u0000item" }],
            },
          ],
        },
      })
      .catch((error: unknown) => error);
    const writes = recording;
    recording = null;

    // Then
    expect(failure).toBeInstanceOf(Error);
    expect(databaseSqlState(failure)).toBe("22021");
    expect(writes.filter((sql) => sql.includes('INSERT INTO "public"."Todo"'))).toHaveLength(2);
    const todos = await client.orm.public.Todo.where({ userId })
      .select("id", "title", "recurrenceGroupId")
      .all();
    expect(todos).toHaveLength(1);
    expect(todos.at(0)).toMatchObject({ title: "앞선 성공 항목", recurrenceGroupId: null });
    expect(
      await client.orm.public.TodoItem.aggregate((aggregate) => ({ count: aggregate.count() })),
    ).toEqual({ count: 0 });
    expect(await repository.findByIdAndUserId(memo.id, userId)).not.toBeNull();
    const events = publishAll.mock.calls
      .flatMap(([published]) => published)
      .filter((event) => event instanceof TodoCreatedEvent);
    expect(events).toHaveLength(1);
    expect(events.at(0)?.todoId).toBe(todos.at(0)?.id);
    process.stdout.write(
      `NOTES_ROLLBACK_AFTER ${JSON.stringify({ sqlState: databaseSqlState(failure), parentInsertStatements: 2, committedTodoCount: todos.length, committedTodoCreatedEvents: events.length, failedRecurringParents: todos.filter((todo) => todo.recurrenceGroupId !== null).length })}\n`,
    );
  });
});
