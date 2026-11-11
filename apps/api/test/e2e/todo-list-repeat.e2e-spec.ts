import {
  createTodoResponseSchema,
  friendTodoListResponseSchema,
  todoListResponseSchema,
  todoSchema,
  updateTodoResponseSchema,
} from "@aido/api";
import { eq } from "drizzle-orm";
import request from "supertest";

import { todoSeries } from "#api/platform/database/schema/index";

import { releasedTodoSchema } from "./fixtures/released-todo-response.schema.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateAfter(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

function nextMonday(): string {
  for (let days = 1; days <= 7; days += 1) {
    const date = dateAfter(days);
    if (new Date(`${date}T00:00:00.000Z`).getUTCDay() === 1) {
      return date;
    }
  }
  throw new Error("월요일을 찾지 못했다");
}

describe("할 일 응답의 반복 정보 E2E", () => {
  let ctx: E2eTestContext;
  let accessToken: string;
  let categoryId: number;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
    const user = await ctx.helpers.createVerifiedUser("list-repeat@example.com", "Test1234!");
    accessToken = user.accessToken;
    categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
  });

  function post(body: object) {
    return request(ctx.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", "Asia/Seoul")
      .send(body);
  }

  function patch(id: number, body: object) {
    return request(ctx.app.getHttpServer())
      .patch(`/v1/todos/${id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", "Asia/Seoul")
      .send(body);
  }

  async function list(query: object = {}) {
    const response = await request(ctx.app.getHttpServer())
      .get("/v1/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", "Asia/Seoul")
      .query(query)
      .expect(200);
    return todoListResponseSchema.parse(response.body.data).items;
  }

  async function createSeries(title: string, repeat: object, startDate = dateAfter(1)) {
    const response = await post({ title, categoryId, startDate, repeat }).expect(201);
    return createTodoResponseSchema.parse(response.body.data);
  }

  it("단일 할 일은 repeat와 occurrenceDate가 null이다", async () => {
    // Given
    const created = await post({ title: "단일", categoryId, startDate: dateAfter(1) }).expect(201);
    // When
    const items = await list();
    // Then
    expect(createTodoResponseSchema.parse(created.body.data).todo).toMatchObject({
      repeat: null,
      occurrenceDate: null,
    });
    expect(items).toEqual([expect.objectContaining({ repeat: null, occurrenceDate: null })]);
  });

  it("반복 회차는 목록·단건·생성 응답에서 같은 규칙과 회차 날짜를 준다", async () => {
    // Given
    const startDate = nextMonday();
    const created = await createSeries(
      "월목 운동",
      { frequency: "WEEKLY", interval: 1, weekdays: ["MON", "THU"], end: { type: "NEVER" } },
      startDate,
    );
    const expected = {
      repeat: {
        frequency: "WEEKLY",
        interval: 1,
        weekdays: ["MON", "THU"],
        end: { type: "NEVER" },
      },
      occurrenceDate: startDate,
    };
    // When
    const items = await list({ startDate, endDate: startDate });
    const single = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/${created.todo.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    // Then
    expect(created.todo).toMatchObject(expected);
    expect(items).toEqual([expect.objectContaining({ id: created.todo.id, ...expected })]);
    expect(todoSchema.parse(single.body.data)).toMatchObject(expected);
  });

  it("끝낸 반복의 회차도 종료가 담긴 규칙을 그대로 준다", async () => {
    // Given
    const created = await createSeries("끝낼 반복", {
      frequency: "DAILY",
      end: { type: "NEVER" },
    });
    await patch(created.todo.id, { repeat: null }).expect(200);
    // When
    const items = await list({
      startDate: created.todo.startDate,
      endDate: created.todo.startDate,
    });
    // Then
    expect(items[0]?.repeat).toMatchObject({
      frequency: "DAILY",
      end: { type: "UNTIL", date: expect.any(String) },
    });
  });

  it("규칙이 없는 옛 묶음은 묶음 ID는 남고 repeat는 null이다", async () => {
    // Given
    const created = await createSeries("옛 묶음", { frequency: "DAILY", end: { type: "NEVER" } });
    await ctx.testDatabase
      .getClient()
      .delete(todoSeries)
      .where(eq(todoSeries.id, created.series?.id ?? ""));
    // When
    const items = await list({
      startDate: created.todo.startDate,
      endDate: created.todo.startDate,
    });
    // Then
    expect(items[0]).toMatchObject({ recurrenceGroupId: created.series?.id, repeat: null });
  });

  it("다른 날로 옮긴 회차도 occurrenceDate는 원래 날짜를 유지한다", async () => {
    // Given
    const created = await createSeries("옮길 회차", {
      frequency: "DAILY",
      end: { type: "COUNT", count: 3 },
    });
    const moved = dateAfter(30);
    // When
    const response = await patch(created.todo.id, { startDate: moved }).expect(200);
    // Then
    expect(updateTodoResponseSchema.parse(response.body.data).todo).toMatchObject({
      startDate: moved,
      occurrenceDate: created.todo.startDate,
    });
    const items = await list({ startDate: moved, endDate: moved });
    expect(items).toEqual([
      expect.objectContaining({ id: created.todo.id, occurrenceDate: created.todo.startDate }),
    ]);
  });

  it("출시 앱 스키마로도 새 키를 버리고 파싱한다", async () => {
    // Given
    await createSeries("출시 앱", { frequency: "DAILY", end: { type: "NEVER" } });
    // When
    const response = await request(ctx.app.getHttpServer())
      .get("/v1/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    // Then
    expect(
      response.body.data.items.map((item: unknown) => releasedTodoSchema.parse(item)),
    ).toHaveLength(response.body.data.items.length);
  });

  it("친구에게 보이는 목록에는 repeat와 occurrenceDate 키가 없다", async () => {
    // Given
    const friend = await ctx.helpers.createVerifiedUser(
      "list-repeat-friend@example.com",
      "Test1234!",
    );
    const owner = await ctx.helpers.createVerifiedUser(
      "list-repeat-owner@example.com",
      "Test1234!",
    );
    await ctx.helpers.createFriendship(friend, owner);
    const ownerCategoryId = await ctx.helpers.getDefaultCategoryId(owner.accessToken);
    await request(ctx.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .set("X-Timezone", "Asia/Seoul")
      .send({
        title: "친구가 보는 반복",
        categoryId: ownerCategoryId,
        startDate: dateAfter(1),
        repeat: { frequency: "DAILY", end: { type: "NEVER" } },
      })
      .expect(201);
    // When
    const response = await request(ctx.app.getHttpServer())
      .get(`/v1/todos/friends/${owner.userId}`)
      .set("Authorization", `Bearer ${friend.accessToken}`)
      .expect(200);
    // Then
    const { items } = friendTodoListResponseSchema.parse(response.body.data);
    expect(items.length).toBeGreaterThan(0);
    for (const item of response.body.data.items) {
      expect(item).not.toHaveProperty("repeat");
      expect(item).not.toHaveProperty("occurrenceDate");
      expect(item.recurrenceGroupId).toEqual(expect.any(String));
    }
  });
});
