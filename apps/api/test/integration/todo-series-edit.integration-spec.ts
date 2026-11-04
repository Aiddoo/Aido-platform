import { randomUUID } from "node:crypto";

import type { TodoRepeat } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { and, asc, eq, sql } from "drizzle-orm";
import { omit } from "es-toolkit";

import { DeleteTodoCategory } from "#api/modules/planning/application/use-cases/categories/delete-todo-category.use-case";
import { MaterializeDueTodoSeries } from "#api/modules/planning/application/use-cases/series/materialize-due-todo-series.use-case";
import { StartSeriesFromTodo } from "#api/modules/planning/application/use-cases/series/start-series-from-todo.use-case";
import { StopTodoSeries } from "#api/modules/planning/application/use-cases/series/stop-todo-series.use-case";
import {
  UpdateFollowingTodos,
  type UpdateFollowingTodosInput,
} from "#api/modules/planning/application/use-cases/series/update-following-todos.use-case";
import { CreateTodo } from "#api/modules/planning/application/use-cases/todos/create-todo.use-case";
import { DeleteTodo } from "#api/modules/planning/application/use-cases/todos/delete-todo.use-case";
import { UpdateTodo } from "#api/modules/planning/application/use-cases/todos/update-todo.use-case";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  todo,
  todoCategory,
  todoComment,
  todoSeries,
  user as userTable,
} from "#api/platform/database/schema/index";
import { MutationLockKeys } from "#api/shared/application/ports/index";
import { JOB_RUNTIME } from "#api/shared/application/ports/job-runtime.port";
import { TodoCategoryFixture, UserFixture } from "#test/fixtures/index";
import type { FakeJobRuntime } from "#test/mocks/fake-job-runtime";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const AT = new Date("2026-11-02T00:00:00.000Z");
const DAILY_NEVER: TodoRepeat = { frequency: "DAILY", end: { type: "NEVER" } };

describe("반복 할 일 범위 수정·삭제 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let userId: string;
  let categoryId: number;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
  });
  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const user = UserFixture.create({
      id: createEntityId(),
      email: "series-edit@example.com",
      userTag: "SEREDIT1",
    });
    await client.insert(userTable).values(user);
    userId = user.id;
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
      .returning();
    if (category == null) {
      throw new Error("카테고리 fixture 누락");
    }
    categoryId = category.id;
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  afterAll(async () => {
    await destroyE2eApp(context);
  });

  async function start(repeat: TodoRepeat = DAILY_NEVER, scheduledTime: string | null = null) {
    const { series, todos } = await context.module.get(CreateTodo).execute({
      userId,
      categoryId,
      title: "원래 제목",
      startDate: AT,
      scheduledTime,
      timezone: "America/New_York",
      items: [{ title: "항목" }],
      repeat,
    });
    if (series == null) {
      throw new Error("규칙 생성 실패");
    }
    return { seriesId: series.id, todos: [...todos] };
  }

  function rowsOf(seriesId: string) {
    return client
      .select()
      .from(todo)
      .where(eq(todo.seriesId, seriesId))
      .orderBy(asc(todo.occurrenceDate));
  }

  function seriesRow(seriesId: string) {
    return client.query.todoSeries.findFirst({ where: { id: seriesId } });
  }

  function following(input: Omit<UpdateFollowingTodosInput, "userId" | "timezone">) {
    return context.module
      .get(UpdateFollowingTodos)
      .execute({ userId, timezone: "America/New_York", ...input });
  }

  function dateOf(value: Date | null | undefined) {
    return value?.toISOString().slice(0, 10);
  }

  async function complete(todoId: number) {
    await client.update(todo).set({ completed: true, completedAt: AT }).where(eq(todo.id, todoId));
  }

  describe("이 할 일만", () => {
    it("회차 날짜를 옮겨도 원래 회차 날짜는 그대로라 다시 만들어지지 않는다", async () => {
      // Given
      const { seriesId, todos } = await start();
      const moved = todos[1];
      const before = await rowsOf(seriesId);
      // When
      await context.module.get(UpdateTodo).execute({
        id: moved?.id ?? 0,
        userId,
        timezone: "UTC",
        scope: "THIS_ONLY",
        data: { startDate: new Date("2026-11-20T00:00:00.000Z"), title: "이것만" },
      });
      vi.setSystemTime(new Date("2026-11-03T00:00:00.000Z"));
      await context.module.get(MaterializeDueTodoSeries).execute();
      // Then
      const row = await client.query.todo.findFirst({ where: { id: moved?.id } });
      expect(dateOf(row?.occurrenceDate)).toBe("2026-11-03");
      expect(dateOf(row?.startDate)).toBe("2026-11-20");
      expect(row?.title).toBe("이것만");
      const after = await rowsOf(seriesId);
      expect(after).toHaveLength(before.length + 1);
      expect(after.filter((other) => dateOf(other.occurrenceDate) === "2026-11-03")).toHaveLength(
        1,
      );
      expect(after.filter((other) => other.title === "이것만")).toHaveLength(1);
    });

    it("이 회차만 지워도 횟수 종료에는 그 날짜를 센다", async () => {
      // Given
      const { seriesId, todos } = await start({
        frequency: "DAILY",
        end: { type: "COUNT", count: 3 },
      });
      // When
      await context.module.get(DeleteTodo).execute({ id: todos[1]?.id ?? 0, userId });
      await context.module.get(MaterializeDueTodoSeries).execute();
      // Then
      const rows = await rowsOf(seriesId);
      expect(rows.map((row) => dateOf(row.occurrenceDate))).toEqual(["2026-11-02", "2026-11-04"]);
      expect((await seriesRow(seriesId))?.nextOccurrenceDate).toBeNull();
    });
  });

  describe("이 할 일과 이후 — 제자리 수정", () => {
    it("제목·공개는 이후 미완료 회차만 바꾸고 앞 회차와 완료 회차는 그대로다", async () => {
      // Given
      const { seriesId, todos } = await start();
      const pivot = todos[2]?.id ?? 0;
      await complete(todos[3]?.id ?? 0);
      const before = await rowsOf(seriesId);
      // When
      await following({ id: pivot, title: "새 제목", visibility: "PRIVATE" });
      // Then
      const rows = await rowsOf(seriesId);
      expect(rows.map((row) => row.id)).toEqual(before.map((row) => row.id));
      expect(rows.slice(0, 2).every((row) => row.title === "원래 제목")).toBe(true);
      expect(rows[3]?.title).toBe("원래 제목");
      expect(rows[2]).toMatchObject({ title: "새 제목", visibility: "PRIVATE" });
      expect(rows[4]).toMatchObject({ title: "새 제목", visibility: "PRIVATE" });
      expect(await seriesRow(seriesId)).toMatchObject({ title: "새 제목", visibility: "PRIVATE" });
    });

    it("규칙이 같으면 나누지 않는다", async () => {
      // Given
      const { seriesId, todos } = await start();
      // When
      await following({ id: todos[2]?.id ?? 0, title: "새 제목", repeat: DAILY_NEVER });
      // Then
      expect(await client.$count(todoSeries, eq(todoSeries.userId, userId))).toBe(1);
      expect((await seriesRow(seriesId))?.startDate).toEqual(AT);
    });

    it("시간을 바꾸면 회차 날짜마다 규칙 시간대로 다시 계산하고 리마인더를 재등록한다", async () => {
      // Given
      vi.setSystemTime(new Date("2027-03-12T00:00:00.000Z"));
      const { seriesId } = await (async () => {
        const created = await context.module.get(CreateTodo).execute({
          userId,
          categoryId,
          title: "DST",
          startDate: new Date("2027-03-13T00:00:00.000Z"),
          scheduledTime: "08:00",
          timezone: "America/New_York",
          repeat: { frequency: "DAILY", end: { type: "COUNT", count: 3 } },
        });
        return { seriesId: created.series?.id ?? "" };
      })();
      const rowsBefore = await rowsOf(seriesId);
      const runtime = context.module.get<FakeJobRuntime>(JOB_RUNTIME);
      runtime.cancelCalls.length = 0;
      runtime.enqueueCalls.length = 0;
      // When
      await following({ id: rowsBefore[0]?.id ?? 0, scheduledTime: "09:30" });
      // Then
      const rows = await rowsOf(seriesId);
      expect(rows.map((row) => row.scheduledTime?.toISOString())).toEqual([
        "2027-03-13T14:30:00.000Z",
        "2027-03-14T13:30:00.000Z",
        "2027-03-15T13:30:00.000Z",
      ]);
      expect(rows.every((row) => !row.isAllDay)).toBe(true);
      expect(runtime.cancelCalls.length).toBeGreaterThan(0);
      expect(runtime.enqueueCalls.map((call) => call.options.idempotencyKey)).toContain(
        `reminder_${rows[0]?.id}_60min`,
      );
    });

    it("시간을 지우면 종일이 되고 예약을 취소한다", async () => {
      // Given
      const { seriesId, todos } = await start(
        { frequency: "DAILY", end: { type: "COUNT", count: 2 } },
        "09:00",
      );
      const runtime = context.module.get<FakeJobRuntime>(JOB_RUNTIME);
      runtime.enqueueCalls.length = 0;
      // When
      await following({ id: todos[0]?.id ?? 0, scheduledTime: null });
      // Then
      const rows = await rowsOf(seriesId);
      expect(rows.every((row) => row.isAllDay && row.scheduledTime == null)).toBe(true);
      expect((await seriesRow(seriesId))?.scheduledLocalTime).toBeNull();
      expect(runtime.enqueueCalls).toEqual([]);
    });
  });

  describe("이 할 일과 이후 — 규칙 변경", () => {
    const WEEKLY_MON: TodoRepeat = {
      frequency: "WEEKLY",
      interval: 1,
      weekdays: ["MON"],
      end: { type: "NEVER" },
    };

    it("나눠도 맞는 회차는 id·댓글이 유지되고 완료 회차는 내용이 그대로다", async () => {
      // Given
      const { seriesId, todos } = await start({
        frequency: "WEEKLY",
        interval: 1,
        weekdays: ["MON", "WED"],
        end: { type: "NEVER" },
      });
      const pivot = todos[2];
      const completed = todos[3];
      await complete(completed?.id ?? 0);
      await client.insert(todoComment).values({
        todoId: pivot?.id ?? 0,
        authorId: userId,
        content: "회차 댓글",
        clientRequestId: randomUUID(),
        requestFingerprint: "series-edit",
      });
      // When
      const response = await following({
        id: pivot?.id ?? 0,
        title: "새 규칙",
        repeat: {
          frequency: "WEEKLY",
          interval: 1,
          weekdays: ["MON", "WED"],
          end: { type: "COUNT", count: 5 },
        },
      });
      // Then
      expect(response.id).toBe(pivot?.id);
      const newSeriesId = response.recurrenceGroupId ?? "";
      expect(newSeriesId).not.toBe(seriesId);
      const moved = await client.query.todo.findFirst({ where: { id: pivot?.id } });
      expect(moved).toMatchObject({ seriesId: newSeriesId, title: "새 규칙" });
      expect(await client.$count(todoComment, eq(todoComment.todoId, pivot?.id ?? 0))).toBe(1);
      const keptCompleted = await client.query.todo.findFirst({ where: { id: completed?.id } });
      expect(keptCompleted).toMatchObject({ completed: true, title: "원래 제목" });
      const before = await rowsOf(seriesId);
      expect(before.map((row) => row.id)).toEqual([todos[0]?.id, todos[1]?.id]);
      expect((await seriesRow(seriesId))?.nextOccurrenceDate).toBeNull();
      expect(dateOf((await seriesRow(seriesId))?.repeatUntil)).toBe("2026-11-08");
      expect(dateOf((await seriesRow(newSeriesId))?.startDate)).toBe(dateOf(moved?.occurrenceDate));
      expect(await rowsOf(newSeriesId)).toHaveLength(5);
    });

    it("새 규칙에 없는 회차는 지우고 기준 회차는 첫 날짜로 옮겨 id를 지킨다", async () => {
      // Given
      const { todos } = await start();
      const pivot = todos[1];
      // When
      const response = await following({ id: pivot?.id ?? 0, repeat: WEEKLY_MON });
      // Then
      expect(response.id).toBe(pivot?.id);
      expect(response.startDate).toBe("2026-11-09");
      const rows = await rowsOf(response.recurrenceGroupId ?? "");
      expect(rows.map((row) => dateOf(row.occurrenceDate)).slice(0, 2)).toEqual([
        "2026-11-09",
        "2026-11-16",
      ]);
      expect(rows.filter((row) => row.id === pivot?.id)).toHaveLength(1);
    });

    it("첫 회차에서 바꾸면 나누지 않고 그 규칙을 고친다", async () => {
      // Given
      const { seriesId, todos } = await start();
      // When
      const response = await following({ id: todos[0]?.id ?? 0, repeat: WEEKLY_MON });
      // Then
      expect(response.recurrenceGroupId).toBe(seriesId);
      expect(await client.$count(todoSeries, eq(todoSeries.userId, userId))).toBe(1);
      expect(await seriesRow(seriesId)).toMatchObject({
        repeatFrequency: "WEEKLY",
        repeatWeekdays: ["MON"],
      });
      const rows = await rowsOf(seriesId);
      expect(rows.every((row) => row.startDate.getUTCDay() === 1)).toBe(true);
    });

    it("횟수 종료를 그대로 둔 체크리스트 변경은 나누고 남은 횟수를 이어받으며 진행을 보존한다", async () => {
      // Given
      const { seriesId, todos } = await start({
        frequency: "DAILY",
        end: { type: "COUNT", count: 5 },
      });
      const pivot = todos[2];
      // When
      const response = await following({ id: pivot?.id ?? 0, checklist: [{ title: "새 항목" }] });
      // Then
      const next = await seriesRow(response.recurrenceGroupId ?? "");
      expect(next).toMatchObject({ repeatCount: 3, checklistTemplate: [{ title: "새 항목" }] });
      const kept = await client.query.todo.findFirst({
        where: { id: pivot?.id },
        with: { items: true },
      });
      expect(kept?.items.map((item) => item.title)).toEqual(["항목"]);
      expect(await rowsOf(seriesId)).toHaveLength(2);
    });

    it("없는 날짜만 남는 규칙이면 TODO_0843이고 아무것도 바뀌지 않는다", async () => {
      // Given
      const { seriesId, todos } = await start();
      const before = await rowsOf(seriesId);
      // When
      const outcome = following({
        id: todos[2]?.id ?? 0,
        repeat: { frequency: "DAILY", end: { type: "UNTIL", date: "2026-11-01" } },
      });
      // Then
      await expect(outcome).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0843 });
      expect(await rowsOf(seriesId)).toHaveLength(before.length);
      expect((await seriesRow(seriesId))?.nextOccurrenceDate).not.toBeNull();
    });
  });

  describe("반복 끝내기", () => {
    it("이 회차 뒤의 미완료만 지우고 완료 회차는 남기며 두 번째는 TODO_0846이다", async () => {
      // Given
      const { seriesId, todos } = await start();
      await complete(todos[3]?.id ?? 0);
      const stop = context.module.get(StopTodoSeries);
      // When
      await stop.execute({ todoId: todos[1]?.id ?? 0, userId });
      const second = stop.execute({ todoId: todos[1]?.id ?? 0, userId });
      // Then
      await expect(second).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0846 });
      const rows = await rowsOf(seriesId);
      expect(rows.map((row) => row.id)).toEqual([todos[0]?.id, todos[1]?.id, todos[3]?.id]);
      expect((await seriesRow(seriesId))?.nextOccurrenceDate).toBeNull();
      expect(dateOf((await seriesRow(seriesId))?.repeatUntil)).toBe("2026-11-03");
    });

    it("끝낸 뒤에는 회차 채우기가 더 만들지 않고 사용량에서도 빠진다", async () => {
      // Given
      const { seriesId, todos } = await start();
      await context.module.get(StopTodoSeries).execute({ todoId: todos[0]?.id ?? 0, userId });
      const before = await rowsOf(seriesId);
      // When
      vi.setSystemTime(new Date("2026-11-10T00:00:00.000Z"));
      await context.module.get(MaterializeDueTodoSeries).execute();
      // Then
      expect(await rowsOf(seriesId)).toHaveLength(before.length);
    });

    it("반복이 아니면 TODO_0844다", async () => {
      // Given
      const { todos } = await context.module.get(CreateTodo).execute({
        userId,
        categoryId,
        title: "단일",
        startDate: AT,
        timezone: "UTC",
      });
      // When
      const outcome = context.module
        .get(StopTodoSeries)
        .execute({ todoId: todos[0]?.id ?? 0, userId });
      // Then
      await expect(outcome).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0844 });
    });
  });

  describe("범위 삭제", () => {
    it("이후 삭제는 미완료만 지우고 반복을 끝낸다", async () => {
      // Given
      const { seriesId, todos } = await start();
      await complete(todos[3]?.id ?? 0);
      // When
      await context.module
        .get(DeleteTodo)
        .execute({ id: todos[1]?.id ?? 0, userId, scope: "THIS_AND_FOLLOWING" });
      // Then
      const rows = await rowsOf(seriesId);
      expect(rows.map((row) => row.id)).toEqual([todos[0]?.id, todos[3]?.id]);
      expect((await seriesRow(seriesId))?.nextOccurrenceDate).toBeNull();
    });

    it("전체 삭제는 완료 회차와 규칙까지 지운다", async () => {
      // Given
      const { seriesId, todos } = await start();
      await complete(todos[3]?.id ?? 0);
      // When
      await context.module.get(DeleteTodo).execute({ id: todos[1]?.id ?? 0, userId, scope: "ALL" });
      // Then
      expect(await rowsOf(seriesId)).toEqual([]);
      expect(await seriesRow(seriesId)).toBeUndefined();
    });

    it("지운 회차의 시간 예약을 취소한다", async () => {
      // Given
      const { todos } = await start(
        { frequency: "DAILY", end: { type: "COUNT", count: 2 } },
        "09:00",
      );
      const runtime = context.module.get<FakeJobRuntime>(JOB_RUNTIME);
      runtime.cancelCalls.length = 0;
      // When
      await context.module.get(DeleteTodo).execute({ id: todos[0]?.id ?? 0, userId, scope: "ALL" });
      // Then
      const keys = runtime.cancelCalls.map((call) => call.idempotencyKey);
      expect(keys).toContain(`reminder_${todos[0]?.id}_60min`);
      expect(keys).toContain(`reminder_${todos[1]?.id}_60min`);
    });

    it.each(["THIS_ONLY", "THIS_AND_FOLLOWING", "ALL"] as const)(
      "반복이 아닌 할 일에 %s를 주면 TODO_0844다",
      async (scope) => {
        // Given
        const { todos } = await context.module.get(CreateTodo).execute({
          userId,
          categoryId,
          title: "단일",
          startDate: AT,
          timezone: "UTC",
        });
        // When
        const outcome = context.module
          .get(DeleteTodo)
          .execute({ id: todos[0]?.id ?? 0, userId, scope });
        // Then
        await expect(outcome).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0844 });
        expect(await client.$count(todo, and(eq(todo.id, todos[0]?.id ?? 0)))).toBe(1);
      },
    );
  });

  describe("단일 → 반복 전환", () => {
    it("그 할 일을 첫 회차로 삼아 id·댓글을 유지하고 체크리스트를 템플릿으로 쓴다", async () => {
      // Given
      const { todos } = await context.module.get(CreateTodo).execute({
        userId,
        categoryId,
        title: "전환",
        startDate: AT,
        scheduledTime: "09:00",
        timezone: "Asia/Seoul",
        items: [{ title: "준비물" }],
      });
      const single = todos[0];
      await client.insert(todoComment).values({
        todoId: single?.id ?? 0,
        authorId: userId,
        content: "유지",
        clientRequestId: randomUUID(),
        requestFingerprint: "series-edit",
      });
      // When
      const response = await context.module.get(StartSeriesFromTodo).execute({
        todoId: single?.id ?? 0,
        userId,
        repeat: { frequency: "DAILY", end: { type: "COUNT", count: 3 } },
        timezone: "Asia/Seoul",
      });
      // Then
      expect(response.id).toBe(single?.id);
      const seriesId = response.recurrenceGroupId ?? "";
      expect(await seriesRow(seriesId)).toMatchObject({
        scheduledLocalTime: "09:00",
        timezone: "Asia/Seoul",
        checklistTemplate: [{ title: "준비물" }],
        generatedCount: 3,
        nextOccurrenceDate: null,
      });
      const rows = await rowsOf(seriesId);
      expect(rows).toHaveLength(3);
      expect(rows[0]?.id).toBe(single?.id);
      expect(await client.$count(todoComment, eq(todoComment.todoId, single?.id ?? 0))).toBe(1);
    });

    it("시작일이 규칙에 맞지 않으면 다음 맞는 날로 옮긴다", async () => {
      // Given
      const { todos } = await context.module.get(CreateTodo).execute({
        userId,
        categoryId,
        title: "전환",
        startDate: AT,
        timezone: "UTC",
      });
      // When
      const response = await context.module.get(StartSeriesFromTodo).execute({
        todoId: todos[0]?.id ?? 0,
        userId,
        repeat: {
          frequency: "WEEKLY",
          interval: 1,
          weekdays: ["FRI"],
          end: { type: "COUNT", count: 2 },
        },
        timezone: "UTC",
      });
      // Then
      expect(response.startDate).toBe("2026-11-06");
      expect(response.id).toBe(todos[0]?.id);
    });

    it("이미 반복인 회차에 범위 없이 규칙을 주면 TODO_0845다", async () => {
      // Given
      const { todos } = await start();
      // When
      const outcome = context.module.get(StartSeriesFromTodo).execute({
        todoId: todos[0]?.id ?? 0,
        userId,
        repeat: DAILY_NEVER,
        timezone: "UTC",
      });
      // Then
      await expect(outcome).rejects.toMatchObject({
        errorCode: ErrorCode.TODO_0845,
        details: { field: "scope" },
      });
    });
  });

  describe("동시성", () => {
    it("규칙을 수정 중이면 회차 채우기는 건너뛰고 수정이 끝난 뒤 이어받는다", async () => {
      // Given
      const { seriesId } = await start();
      const held = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const holder = client.transaction(async (tx) => {
        await tx.execute(sql`SELECT "id" FROM "TodoSeries" WHERE "id" = ${seriesId} FOR UPDATE`);
        held.resolve();
        await release.promise;
      });
      await held.promise;
      vi.setSystemTime(new Date("2026-11-03T00:00:00.000Z"));
      const before = await rowsOf(seriesId);
      let skipped;
      try {
        // When
        skipped = await context.module.get(MaterializeDueTodoSeries).execute();
      } finally {
        release.resolve();
        await holder;
      }
      const resumed = await context.module.get(MaterializeDueTodoSeries).execute();
      // Then
      expect(skipped.createdCount).toBe(0);
      expect(resumed.createdCount).toBe(1);
      expect(await rowsOf(seriesId)).toHaveLength(before.length + 1);
    });

    describe("카테고리 삭제와 규칙 작업이 겹칠 때", () => {
      /** 정렬 잠금을 쥔 채 작업을 차례로 대기열에 세워, 카테고리 삭제가 먼저 잠금을 받는 순서를 만든다. */
      async function queueBehindCategoryDelete(
        moveToCategoryId: number,
        contender: () => Promise<unknown>,
      ) {
        const held = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const holder = client.transaction(async (tx) => {
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${MutationLockKeys.todoSortOrder(userId)}, 0))`,
          );
          held.resolve();
          await release.promise;
        });
        await held.promise;
        const waitForWaiters = (count: number) =>
          vi.waitFor(
            async () => {
              const waiting = await client.execute<{ count: number }>(sql`
                SELECT count(*)::int AS count FROM pg_locks
                WHERE locktype = 'advisory' AND NOT granted
                AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
              `);
              expect(waiting.rows[0]?.count).toBe(count);
            },
            { timeout: 5000, interval: 10 },
          );
        const deleting = context.module
          .get(DeleteTodoCategory, { strict: false })
          .execute({ userId, categoryId, moveToCategoryId });
        await waitForWaiters(1);
        const contending = contender();
        await waitForWaiters(2);
        release.resolve();
        await holder;
        return Promise.allSettled([deleting, contending]);
      }

      it.each([
        {
          name: "이후 회차 수정",
          contender: (todoId: number) => following({ id: todoId, title: "새 제목" }),
        },
        {
          name: "반복 끝내기",
          contender: (todoId: number) =>
            context.module.get(StopTodoSeries).execute({ todoId, userId }),
        },
        {
          name: "이후 삭제",
          contender: (todoId: number) =>
            context.module
              .get(DeleteTodo)
              .execute({ id: todoId, userId, scope: "THIS_AND_FOLLOWING" }),
        },
        {
          name: "회차 채우기",
          contender: async () => {
            const result = await context.module.get(MaterializeDueTodoSeries).execute();
            expect(result).toMatchObject({ failedCount: 0, createdCount: 1 });
          },
        },
      ])(
        "$name: 같은 잠금 순서라 교착 없이 차례로 끝나고 규칙은 새 카테고리로 옮겨진다",
        async ({ contender }) => {
          // Given
          const { seriesId, todos } = await start();
          const [target] = await client
            .insert(todoCategory)
            .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 1 }), ["id"]))
            .returning();
          if (target == null) {
            throw new Error("이동할 카테고리 fixture 누락");
          }
          vi.setSystemTime(new Date("2026-11-03T00:00:00.000Z"));
          // When
          const outcomes = await queueBehindCategoryDelete(target.id, () =>
            contender(todos[1]?.id ?? 0),
          );
          // Then
          expect(outcomes.map((outcome) => outcome.status)).toEqual(["fulfilled", "fulfilled"]);
          expect((await seriesRow(seriesId))?.categoryId).toBe(target.id);
        },
      );
    });

    it("수정 두 번이 동시에 와도 잠금으로 차례대로 처리해 규칙이 하나로 끝난다", async () => {
      // Given
      const { seriesId, todos } = await start();
      // When
      await Promise.all([
        following({ id: todos[1]?.id ?? 0, title: "A" }),
        following({ id: todos[2]?.id ?? 0, title: "B" }),
      ]);
      // Then
      expect(await client.$count(todoSeries, eq(todoSeries.userId, userId))).toBe(1);
      expect(["A", "B"]).toContain((await seriesRow(seriesId))?.title);
    });
  });
});
