import {
  createTodoResponseSchema,
  friendTodoListResponseSchema,
  todoListResponseSchema,
  updateTodoResponseSchema,
} from "@aido/api";
import { TODO_SERIES_LIMITS } from "@aido/api/vocabulary";
import { eq } from "drizzle-orm";
import request from "supertest";
import { z } from "zod";

import { RebaseTodoTimezoneUseCase } from "#api/modules/planning/todos/application/use-cases/rebase-todo-timezone.use-case";
import { TODO_TIMEZONE_REBASE_QUEUE } from "#api/modules/planning/todos/infrastructure/jobs/todo-timezone-rebase.queue";
import { todoSeries, userPreference } from "#api/platform/database/schema/index";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { toIsoString } from "#api/shared/domain/time/instant";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import {
  nowInstant,
  shiftDateKey,
  todayIn,
  todayUtc,
  wallClockInstant,
} from "#test/fixtures/clock.fixture";

import { releasedTodoSchema } from "./fixtures/released-todo-response.schema.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const SEOUL = "Asia/Seoul";
const NEW_YORK = "America/New_York";
const releasedListSchema = z.object({ items: z.array(releasedTodoSchema) });

describe("떠 있는 시각 E2E", () => {
  let ctx: E2eTestContext;
  let owner: Awaited<ReturnType<E2eTestContext["helpers"]["createVerifiedUser"]>>;
  let accessToken: string;
  let userId: string;
  let categoryId: number;
  const date = () => shiftDateKey(todayIn(SEOUL).toString(), 3);

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);
  afterAll(async () => {
    await destroyE2eApp(ctx);
  });
  beforeEach(async () => {
    await ctx.reset();
    owner = await ctx.helpers.createVerifiedUser("floating@example.com", "Test1234!");
    accessToken = owner.accessToken;
    userId = owner.userId;
    categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
  });

  function rebaseJobQueue(): InMemoryJobQueue {
    const jobQueue = ctx.module.get(JobQueuePort);
    if (!(jobQueue instanceof InMemoryJobQueue)) {
      throw new Error("E2E 앱은 InMemoryJobQueue를 쓴다");
    }
    return jobQueue;
  }

  function send(
    method: "post" | "patch" | "get",
    path: string,
    timezone: string | null,
    body?: object,
    token = accessToken,
  ) {
    const call = request(ctx.app.getHttpServer())
      [method](path)
      .set("Authorization", `Bearer ${token}`);
    if (timezone != null) {
      void call.set("X-Timezone", timezone);
    }
    return body == null ? call : call.send(body);
  }

  async function createTimed(timezone: string | null, time = "10:00", extra: object = {}) {
    const response = await send("post", "/v1/todos", timezone, {
      title: "회의",
      categoryId,
      startDate: date(),
      scheduledTime: time,
      isAllDay: false,
      ...extra,
    }).expect(201);
    return createTodoResponseSchema.parse(response.body.data).todo;
  }

  async function storeTimezone(timezone: string) {
    await ctx.testDatabase
      .getClient()
      .update(userPreference)
      .set({ timezone })
      .where(eq(userPreference.userId, userId));
  }

  const patchedTodo = (response: request.Response) =>
    updateTodoResponseSchema.parse(response.body.data).todo;

  it("서울에서 만든 오전 10시는 뉴욕 기기로 읽어도 오전 10시다", async () => {
    // Given
    const created = await createTimed(SEOUL);
    // When
    const response = await send("get", "/v1/todos", NEW_YORK).expect(200);
    // Then
    const [item] = todoListResponseSchema.parse(response.body.data).items;
    expect(created.scheduledLocalTime).toBe("10:00");
    expect(item?.scheduledLocalTime).toBe("10:00");
    expect(item?.scheduledTime).toBe(toIsoString(wallClockInstant(date(), "10:00", SEOUL)));
  });

  it("출시 앱 응답 모양을 그대로 지킨다", async () => {
    // Given
    const created = await createTimed(SEOUL);
    // When
    const parsed = releasedTodoSchema.parse(created);
    // Then
    expect(parsed.scheduledTime).toBe(toIsoString(wallClockInstant(date(), "10:00", SEOUL)));
  });

  it("친구 화면도 작성자의 벽시계를 그대로 보여 준다", async () => {
    // Given
    const friend = await ctx.helpers.createVerifiedUser("floating-friend@example.com", "Test1234!");
    await ctx.helpers.createFriendship(friend, owner);
    await createTimed(SEOUL);
    // When
    const response = await send(
      "get",
      `/v1/todos/friends/${userId}?startDate=${date()}`,
      NEW_YORK,
      undefined,
      friend.accessToken,
    ).expect(200);
    // Then
    const [item] = friendTodoListResponseSchema.parse(response.body.data).items;
    expect(item?.scheduledLocalTime).toBe("10:00");
  });

  it.each([
    {
      name: "PATCH로 시간만 고치면 그 기기 시간대의 그 시각이다",
      body: { scheduledTime: "15:30" },
      local: "15:30",
      zone: NEW_YORK,
      dateOffset: 0,
    },
    {
      name: "날짜만 옮기면 벽시계는 그대로이고 새 날짜의 순간이 된다",
      body: { startDate: "OFFSET" },
      local: "10:00",
      zone: NEW_YORK,
      dateOffset: 2,
    },
  ])("$name", async ({ body, local, zone, dateOffset }) => {
    // Given
    const created = await createTimed(SEOUL);
    const moved = shiftDateKey(date(), dateOffset);
    const payload = "startDate" in body ? { startDate: moved } : body;
    // When
    const response = await send("patch", `/v1/todos/${created.id}`, zone, payload).expect(200);
    // Then
    const todo = patchedTodo(response);
    expect(todo.scheduledLocalTime).toBe(local);
    expect(todo.startDate).toBe(moved);
    expect(todo.scheduledTime).toBe(toIsoString(wallClockInstant(moved, local, zone)));
  });

  it("일정 변경 경로도 벽시계를 함께 저장하고 종일로 바꾸면 비운다", async () => {
    // Given
    const created = await createTimed(SEOUL);
    // When
    const timed = await send("patch", `/v1/todos/${created.id}/schedule`, NEW_YORK, {
      startDate: date(),
      scheduledTime: "08:15",
      isAllDay: false,
    }).expect(200);
    const allDay = await send("patch", `/v1/todos/${created.id}/schedule`, NEW_YORK, {
      startDate: date(),
      isAllDay: true,
    }).expect(200);
    // Then
    expect(patchedTodo(timed).scheduledLocalTime).toBe("08:15");
    expect(patchedTodo(timed).scheduledTime).toBe(
      toIsoString(wallClockInstant(date(), "08:15", NEW_YORK)),
    );
    expect(patchedTodo(allDay)).toMatchObject({
      scheduledLocalTime: null,
      scheduledTime: null,
      isAllDay: true,
    });
  });

  it("시간 없음 → 있음 → 없음 전환에서 칸이 함께 맞는다", async () => {
    // Given
    const created = await send("post", "/v1/todos", SEOUL, {
      title: "종일",
      categoryId,
      startDate: date(),
      isAllDay: true,
    }).expect(201);
    const { todo } = createTodoResponseSchema.parse(created.body.data);
    // When
    const timed = await send("patch", `/v1/todos/${todo.id}`, SEOUL, {
      scheduledTime: "09:00",
      isAllDay: false,
    }).expect(200);
    const cleared = await send("patch", `/v1/todos/${todo.id}`, SEOUL, { isAllDay: true }).expect(
      200,
    );
    // Then
    expect(todo.scheduledLocalTime).toBeNull();
    expect(patchedTodo(timed)).toMatchObject({ scheduledLocalTime: "09:00", isAllDay: false });
    expect(patchedTodo(cleared)).toMatchObject({ scheduledLocalTime: null, isAllDay: true });
  });

  it.each([
    { name: "완료 토글", path: (id: number) => `/v1/todos/${id}/complete` },
    { name: "일반 PATCH", path: (id: number) => `/v1/todos/${id}` },
  ])("$name로 완료를 되돌려도 순간은 재계산에 맡기고 따로 고치지 않는다", async ({ path }) => {
    // Given
    const created = await createTimed(SEOUL);
    await send("patch", path(created.id), SEOUL, { completed: true }).expect(200);
    // When
    const response = await send("patch", path(created.id), NEW_YORK, {
      completed: false,
    }).expect(200);
    // Then
    expect(patchedTodo(response)).toMatchObject({
      scheduledLocalTime: "10:00",
      scheduledTime: toIsoString(wallClockInstant(date(), "10:00", SEOUL)),
    });
  });

  it("옛 앱은 서울 → 뉴욕 → 서울 왕복에서 지난 완료 할 일도 그곳의 오전 10시로 읽는다", async () => {
    // Given
    const past = shiftDateKey(todayIn(SEOUL).toString(), -30);
    const created = await createTimed(SEOUL, "10:00", { startDate: past });
    await send("patch", `/v1/todos/${created.id}/complete`, SEOUL, { completed: true }).expect(200);
    const readLocalTimeIn = async (timezone: string) => {
      const response = await send(
        "get",
        `/v1/todos?startDate=${past}&endDate=${past}`,
        timezone,
      ).expect(200);
      const [item] = releasedListSchema.parse(response.body.data).items;
      return item?.scheduledTime == null
        ? null
        : Temporal.Instant.from(item.scheduledTime)
            .toZonedDateTimeISO(timezone)
            .toPlainTime()
            .toString({ smallestUnit: "minute" });
    };
    const rebaseTo = async (timezone: string) => {
      await storeTimezone(timezone);
      await ctx.module.get(RebaseTodoTimezoneUseCase).execute({ userId });
    };
    // When
    await rebaseTo(NEW_YORK);
    const inNewYork = await readLocalTimeIn(NEW_YORK);
    await rebaseTo(SEOUL);
    const backInSeoul = await readLocalTimeIn(SEOUL);
    // Then
    expect(inNewYork).toBe("10:00");
    expect(backInSeoul).toBe("10:00");
  });

  it("제목만 고치면 순간을 건드리지 않는다", async () => {
    // Given
    const created = await createTimed(SEOUL);
    // When
    const response = await send("patch", `/v1/todos/${created.id}/title`, NEW_YORK, {
      title: "새 제목",
    }).expect(200);
    // Then
    expect(patchedTodo(response)).toMatchObject({
      scheduledTime: created.scheduledTime,
      scheduledLocalTime: "10:00",
    });
  });

  it.each([
    { name: "헤더 없음", header: null },
    { name: "잘못된 헤더", header: "Mars/Phobos" },
  ])("$name: 저장된 사용자 시간대로 해석하고 재계산을 시작하지 않는다", async ({ header }) => {
    // Given
    await storeTimezone("Europe/London");
    const jobQueue = rebaseJobQueue();
    const before = jobQueue.jobsIn(TODO_TIMEZONE_REBASE_QUEUE).length;
    // When
    const created = await createTimed(header);
    // Then
    expect(created.scheduledTime).toBe(
      toIsoString(wallClockInstant(date(), "10:00", "Europe/London")),
    );
    expect(jobQueue.jobsIn(TODO_TIMEZONE_REBASE_QUEUE)).toHaveLength(before);
    const stored = await ctx.testDatabase
      .getClient()
      .query.userPreference.findFirst({ where: { userId } });
    expect(stored?.timezone).toBe("Europe/London");
  });

  it("저장 시간대가 잘못됐으면 기본값 Asia/Seoul로 해석한다", async () => {
    // Given
    await storeTimezone("Mars/Phobos");
    // When
    const created = await createTimed(null);
    // Then
    expect(created.scheduledTime).toBe(toIsoString(wallClockInstant(date(), "10:00", SEOUL)));
  });

  it("기기 시간대가 바뀌면 사용자당 지연 작업을 하나 넣는다", async () => {
    // Given
    await storeTimezone(SEOUL);
    const jobQueue = rebaseJobQueue();
    const rebaseCalls = () =>
      jobQueue
        .jobsIn(TODO_TIMEZONE_REBASE_QUEUE)
        .filter((job) => job.options.idempotencyKey?.includes(userId) === true);
    // When
    await send("get", "/v1/todos", NEW_YORK).expect(200);
    await vi.waitFor(() => expect(rebaseCalls()).toHaveLength(1));
    // Then
    const [call] = rebaseCalls();
    expect(call?.payload).toEqual({ name: "rebase-todo-timezone", data: { userId } });
    expect(call?.options.startAfter?.epochMilliseconds).toBeGreaterThan(Date.now() - 60_000);
    await vi.waitFor(async () => {
      const stored = await ctx.testDatabase
        .getClient()
        .query.userPreference.findFirst({ where: { userId } });
      expect(stored?.timezone).toBe(NEW_YORK);
    });
  });

  it("옛 경로 상한 안에서는 30개를 넘어도 그대로 만들고 벽시계를 채운다", async () => {
    // Given
    await ctx.testDatabase
      .getClient()
      .insert(todoSeries)
      .values(
        Array.from({ length: TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER }, () => {
          const id = createEntityId();
          return {
            id,
            originSeriesId: id,
            userId,
            categoryId,
            title: "시드",
            timezone: "UTC",
            repeatFrequency: "DAILY" as const,
            startDate: todayUtc(),
            nextOccurrenceDate: todayUtc(),
            updatedAt: nowInstant(),
          };
        }),
      );
    // When
    const response = await send("post", "/v1/todos/recurring", SEOUL, {
      title: "옛 앱 반복",
      categoryId,
      startDate: date(),
      endDate: shiftDateKey(date(), 14),
      daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      scheduledTime: "07:00",
      isAllDay: false,
    });
    // Then
    expect(response.status).toBe(201);
    const rows = await ctx.testDatabase
      .getClient()
      .query.todo.findMany({ where: { userId, seriesId: { isNotNull: true } } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.scheduledLocalTime === "07:00")).toBe(true);
  });
});

describe("떠 있는 시각 표 (시간대 × 할 일 종류)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);
  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it.each([
    { name: "뉴욕", header: NEW_YORK, zone: NEW_YORK },
    { name: "런던", header: "Europe/London", zone: "Europe/London" },
    { name: "하와이", header: "Pacific/Honolulu", zone: "Pacific/Honolulu" },
    { name: "UTC+14", header: "Pacific/Kiritimati", zone: "Pacific/Kiritimati" },
    { name: "잘못된 헤더(저장값 서울)", header: "Mars/Phobos", zone: SEOUL },
  ])("서울에서 만든 뒤 $name: 종류마다 맞는 값이다", async ({ header, zone }) => {
    // Given
    await ctx.reset();
    const owner = await ctx.helpers.createVerifiedUser("table@example.com", "Test1234!");
    const friend = await ctx.helpers.createVerifiedUser("table-friend@example.com", "Test1234!");
    await ctx.helpers.createFriendship(friend, owner);
    const categoryId = await ctx.helpers.getDefaultCategoryId(owner.accessToken);
    const today = todayIn(SEOUL).toString();
    const future = shiftDateKey(today, 5);
    const past = shiftDateKey(today, -5);
    const client = ctx.testDatabase.getClient();
    const server = ctx.app.getHttpServer();
    const post = async (body: object) => {
      const response = await request(server)
        .post("/v1/todos")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .set("X-Timezone", SEOUL)
        .send({ categoryId, isAllDay: false, scheduledTime: "10:00", ...body })
        .expect(201);
      return createTodoResponseSchema.parse(response.body.data);
    };
    const general = await post({ title: "일반", startDate: future });
    const allDay = await post({
      title: "종일",
      startDate: future,
      isAllDay: true,
      scheduledTime: null,
    });
    const period = await post({
      title: "기간",
      startDate: future,
      endDate: shiftDateKey(future, 2),
    });
    const repeating = await post({
      title: "반복",
      startDate: future,
      repeat: { frequency: "DAILY", end: { type: "COUNT", count: 2 } },
    });
    const completed = await post({ title: "완료", startDate: future });
    await request(server)
      .patch(`/v1/todos/${completed.todo.id}/complete`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .set("X-Timezone", SEOUL)
      .send({ completed: true })
      .expect(200);
    const pastDay = await post({ title: "지난 날", startDate: past });
    await client
      .update(userPreference)
      .set({ timezone: zone })
      .where(eq(userPreference.userId, owner.userId));
    // When
    await ctx.module.get(RebaseTodoTimezoneUseCase).execute({ userId: owner.userId });
    const ownerRows = await request(server)
      .get(`/v1/todos?startDate=${past}&endDate=${shiftDateKey(future, 3)}&size=50`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .set("X-Timezone", header)
      .expect(200);
    const friendRows = await request(server)
      .get(`/v1/todos/friends/${owner.userId}?startDate=${future}&endDate=${future}&size=50`)
      .set("Authorization", `Bearer ${friend.accessToken}`)
      .set("X-Timezone", header)
      .expect(200);
    // Then
    const items = new Map(
      todoListResponseSchema.parse(ownerRows.body.data).items.map((item) => [item.id, item]),
    );
    const moved = toIsoString(wallClockInstant(future, "10:00", zone));
    expect(items.get(general.todo.id)).toMatchObject({
      scheduledLocalTime: "10:00",
      scheduledTime: moved,
      startDate: future,
    });
    expect(items.get(allDay.todo.id)).toMatchObject({
      scheduledLocalTime: null,
      scheduledTime: null,
      startDate: future,
    });
    expect(items.get(period.todo.id)).toMatchObject({
      scheduledLocalTime: "10:00",
      scheduledTime: moved,
    });
    expect(items.get(repeating.todo.id)).toMatchObject({
      scheduledLocalTime: "10:00",
      scheduledTime: moved,
    });
    expect(items.get(completed.todo.id)).toMatchObject({
      scheduledLocalTime: "10:00",
      scheduledTime: moved,
    });
    expect(items.get(pastDay.todo.id)).toMatchObject({
      scheduledLocalTime: "10:00",
      scheduledTime: toIsoString(wallClockInstant(past, "10:00", zone)),
    });
    const friendItems = friendTodoListResponseSchema.parse(friendRows.body.data).items;
    expect(friendItems.length).toBeGreaterThan(0);
    expect(
      friendItems.every((item) =>
        item.scheduledTime == null
          ? item.scheduledLocalTime == null
          : item.scheduledLocalTime === "10:00",
      ),
    ).toBe(true);
  });
});
