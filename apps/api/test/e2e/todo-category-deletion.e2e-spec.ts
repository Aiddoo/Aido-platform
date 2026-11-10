import {
  createTodoResponseSchema,
  deleteTodoCategoryResponseSchema,
  todoCategoryDeletionPreviewSchema,
  todoCategoryListResponseSchema,
} from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { eq } from "drizzle-orm";
import request from "supertest";
import { z } from "zod";

import { todo, todoSeries, user as userTable } from "#api/platform/database/schema/index";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const PASSWORD = "Test1234!";
const LONG_AGO = Temporal.Instant.from("2026-01-01T00:00:00Z");

// 1.15.0까지 출시 앱이 번들한 삭제 응답 schema. Zod 기본 strip이라 새 칸을 버린다
const releasedDeleteTodoCategoryResponseSchema = z.object({ message: z.string() });

function dateAfter(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

describe("카테고리 삭제 선택 E2E", () => {
  let ctx: E2eTestContext;
  let accessToken: string;
  let userId: string;
  let defaultCategoryId: number;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
    const user = await ctx.helpers.createVerifiedUser("category-deletion@example.com", PASSWORD);
    accessToken = user.accessToken;
    userId = user.userId;
    await ctx.testDatabase
      .getClient()
      .update(userTable)
      .set({ subscriptionStatus: "ACTIVE" })
      .where(eq(userTable.id, userId));
    defaultCategoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
  });

  function api() {
    return request(ctx.app.getHttpServer());
  }

  async function createCategory(name: string): Promise<number> {
    const response = await api()
      .post("/v1/todo-categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name, color: "#00AA00" })
      .expect(201);
    return z.object({ category: z.object({ id: z.number() }) }).parse(response.body.data).category
      .id;
  }

  function postTodo(body: object) {
    return api()
      .post("/v1/todos")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", "Asia/Seoul")
      .send(body);
  }

  async function createTodo(categoryId: number, body: object = {}): Promise<number> {
    const response = await postTodo({
      title: "할 일",
      categoryId,
      startDate: dateAfter(1),
      ...body,
    }).expect(201);
    return createTodoResponseSchema.parse(response.body.data).todo.id;
  }

  async function completeTodo(todoId: number): Promise<void> {
    await api()
      .patch(`/v1/todos/${todoId}/complete`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", "Asia/Seoul")
      .send({ completed: true })
      .expect(200);
  }

  function deleteCategory(categoryId: number, query: Record<string, string | number> = {}) {
    return api()
      .delete(`/v1/todo-categories/${categoryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .query(query);
  }

  function previewOf(categoryId: number, token = accessToken) {
    return api()
      .get(`/v1/todo-categories/${categoryId}/deletion-preview`)
      .set("Authorization", `Bearer ${token}`);
  }

  async function todoCountIn(categoryId: number): Promise<number> {
    const response = await api()
      .get("/v1/todo-categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const list = todoCategoryListResponseSchema.parse(response.body.data);
    return list.items.find((category) => category.id === categoryId)?.todoCount ?? -1;
  }

  describe("출시 앱 요청 (todoHandling 없음)", () => {
    it("할 일이 있으면 지금처럼 TODO_CATEGORY_0855로 거절하고 아무것도 지우지 않는다", async () => {
      // Given
      const categoryId = await createCategory("공부");
      await createTodo(categoryId);
      await createTodo(categoryId);

      // When
      const response = await deleteCategory(categoryId).expect(400);

      // Then
      // 0855는 PUBLIC_ERROR_DETAILS에 없어 운영처럼 details 없이 나간다(출시 앱은 코드로만 분기한다)
      expect(response.body.error.code).toBe(ErrorCode.TODO_CATEGORY_0855);
      expect(response.body.error.details).toBeUndefined();
      expect(await todoCountIn(categoryId)).toBe(2);
    });

    it("moveToCategoryId만 보내면 지금처럼 옮긴 뒤 지우고 출시 앱 응답 schema로도 읽힌다", async () => {
      // Given
      const categoryId = await createCategory("공부");
      const todoId = await createTodo(categoryId);
      await ctx.testDatabase
        .getClient()
        .update(todo)
        .set({ updatedAt: LONG_AGO })
        .where(eq(todo.id, todoId));

      // When
      const response = await deleteCategory(categoryId, {
        moveToCategoryId: defaultCategoryId,
      }).expect(200);

      // Then
      expect(releasedDeleteTodoCategoryResponseSchema.parse(response.body.data)).toEqual({
        message: "카테고리가 삭제되었습니다.",
      });
      expect(deleteTodoCategoryResponseSchema.parse(response.body.data).result).toEqual({
        todoHandling: "move",
        todoCount: 1,
        seriesCount: 0,
        moveToCategoryId: defaultCategoryId,
      });
      const moved = await ctx.testDatabase
        .getClient()
        .query.todo.findFirst({ where: { id: todoId } });
      expect(moved?.categoryId).toBe(defaultCategoryId);
      // 앱 동기화가 updatedAt으로 바뀐 할 일을 다시 받는다
      expect(moved?.updatedAt.equals(LONG_AGO)).toBe(false);
    });
  });

  describe("GET /v1/todo-categories/:id/deletion-preview", () => {
    it("할 일·완료·진행 중 반복 수와 마지막 카테고리 여부를 삭제와 같은 기준으로 준다", async () => {
      // Given
      const categoryId = await createCategory("운동");
      await createTodo(categoryId);
      await completeTodo(await createTodo(categoryId));
      await createTodo(categoryId, {
        repeat: { frequency: "DAILY", end: { type: "NEVER" } },
      });
      const todoCount = await todoCountIn(categoryId);

      // When
      const response = await previewOf(categoryId).expect(200);

      // Then
      expect(todoCategoryDeletionPreviewSchema.parse(response.body.data)).toEqual({
        categoryId,
        todoCount,
        completedTodoCount: 1,
        activeSeriesCount: 1,
        isLastCategory: false,
      });
    });

    it("마지막 남은 카테고리면 isLastCategory가 true다", async () => {
      // Given
      const categories = await api()
        .get("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      const [first, second] = todoCategoryListResponseSchema.parse(categories.body.data).items;
      await deleteCategory(first?.id ?? 0).expect(200);

      // When
      const response = await previewOf(second?.id ?? 0).expect(200);

      // Then
      expect(todoCategoryDeletionPreviewSchema.parse(response.body.data).isLastCategory).toBe(true);
    });

    it("다른 사용자의 카테고리는 TODO_CATEGORY_0851로 숨긴다", async () => {
      // Given
      const other = await ctx.helpers.createVerifiedUser("category-other@example.com", PASSWORD);

      // When
      const response = await previewOf(defaultCategoryId, other.accessToken).expect(404);

      // Then
      expect(response.body.error.code).toBe(ErrorCode.TODO_CATEGORY_0851);
    });
  });

  describe("todoHandling", () => {
    it("delete는 할 일·하위 항목·반복 규칙을 함께 지우고 지운 할 일은 404다", async () => {
      // Given
      const categoryId = await createCategory("정리");
      const scheduledTodoId = await createTodo(categoryId, {
        scheduledTime: "09:00",
        isAllDay: false,
        items: [{ title: "하위 항목" }],
      });
      await completeTodo(await createTodo(categoryId));
      await createTodo(categoryId, {
        repeat: { frequency: "DAILY", end: { type: "NEVER" } },
      });
      const keptTodoId = await createTodo(defaultCategoryId);
      const todoCount = await todoCountIn(categoryId);

      // When
      const response = await deleteCategory(categoryId, { todoHandling: "delete" }).expect(200);

      // Then
      expect(deleteTodoCategoryResponseSchema.parse(response.body.data).result).toEqual({
        todoHandling: "delete",
        todoCount,
        seriesCount: 1,
        moveToCategoryId: null,
      });
      const db = ctx.testDatabase.getClient();
      expect(await db.$count(todo, eq(todo.categoryId, categoryId))).toBe(0);
      expect(await db.$count(todoSeries, eq(todoSeries.categoryId, categoryId))).toBe(0);
      const gone = await api()
        .get(`/v1/todos/${scheduledTodoId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);
      expect(gone.body.error.code).toBe(ErrorCode.TODO_0801);
      await api()
        .get(`/v1/todos/${keptTodoId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
    });

    it("move는 moveToCategoryId로 할 일과 반복 규칙을 옮긴 뒤 지운다", async () => {
      // Given
      const categoryId = await createCategory("이사");
      await createTodo(categoryId);
      await createTodo(categoryId, {
        repeat: { frequency: "DAILY", end: { type: "NEVER" } },
      });
      const todoCount = await todoCountIn(categoryId);
      const targetCountBefore = await todoCountIn(defaultCategoryId);

      // When
      const response = await deleteCategory(categoryId, {
        todoHandling: "move",
        moveToCategoryId: defaultCategoryId,
      }).expect(200);

      // Then
      expect(deleteTodoCategoryResponseSchema.parse(response.body.data).result).toEqual({
        todoHandling: "move",
        todoCount,
        seriesCount: 1,
        moveToCategoryId: defaultCategoryId,
      });
      expect(await todoCountIn(defaultCategoryId)).toBe(targetCountBefore + todoCount);
      expect(
        await ctx.testDatabase
          .getClient()
          .$count(todoSeries, eq(todoSeries.categoryId, defaultCategoryId)),
      ).toBe(1);
    });

    it("할 일이 없으면 none으로 바로 지운다", async () => {
      // Given
      const categoryId = await createCategory("빈 칸");

      // When
      const response = await deleteCategory(categoryId, { todoHandling: "delete" }).expect(200);

      // Then
      expect(deleteTodoCategoryResponseSchema.parse(response.body.data).result).toEqual({
        todoHandling: "none",
        todoCount: 0,
        seriesCount: 0,
        moveToCategoryId: null,
      });
    });

    it.each<{ name: string; query: Record<string, string | number> }>([
      { name: "move인데 옮길 곳이 없음", query: { todoHandling: "move" } },
      { name: "delete인데 옮길 곳이 있음", query: { todoHandling: "delete", moveToCategoryId: 1 } },
      { name: "모르는 처리 값", query: { todoHandling: "archive" } },
    ])("$name이면 SYS_0002로 거절하고 지우지 않는다", async ({ query }) => {
      // Given
      const categoryId = await createCategory("검증");
      await createTodo(categoryId);

      // When
      const response = await deleteCategory(categoryId, query).expect(400);

      // Then
      expect(response.body.error.code).toBe(ErrorCode.SYS_0002);
      expect(await todoCountIn(categoryId)).toBe(1);
    });

    it("함께 지우기를 골라도 마지막 카테고리는 TODO_CATEGORY_0854다", async () => {
      // Given
      const categories = await api()
        .get("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      const [first, second] = todoCategoryListResponseSchema.parse(categories.body.data).items;
      await deleteCategory(first?.id ?? 0).expect(200);
      await createTodo(second?.id ?? 0);

      // When
      const response = await deleteCategory(second?.id ?? 0, { todoHandling: "delete" }).expect(
        400,
      );

      // Then
      expect(response.body.error.code).toBe(ErrorCode.TODO_CATEGORY_0854);
    });
  });

  describe("동시 요청", () => {
    it("지우는 카테고리에 동시에 만든 할 일은 함께 지워지거나 만들기가 TODO_CATEGORY_0851로 거절된다", async () => {
      // Given
      const categoryId = await createCategory("경합");
      await createTodo(categoryId);

      // When
      const [deletion, creation] = await Promise.all([
        deleteCategory(categoryId, { todoHandling: "delete" }),
        postTodo({ title: "늦게 온 할 일", categoryId, startDate: dateAfter(1) }),
      ]);

      // Then
      expect(deletion.status).toBe(200);
      expect([201, 404]).toContain(creation.status);
      if (creation.status === 404) {
        expect(creation.body.error.code).toBe(ErrorCode.TODO_CATEGORY_0851);
      }
      expect(await ctx.testDatabase.getClient().$count(todo, eq(todo.categoryId, categoryId))).toBe(
        0,
      );
    });

    it("지우는 동안 고친 할 일은 되살아나지 않는다", async () => {
      // Given
      const categoryId = await createCategory("경합 수정");
      const todoIds = [];
      for (let index = 0; index < 5; index += 1) {
        todoIds.push(await createTodo(categoryId));
      }

      // When
      const [deletion, ...updates] = await Promise.all([
        deleteCategory(categoryId, { todoHandling: "delete" }),
        ...todoIds.map((todoId) =>
          api()
            .patch(`/v1/todos/${todoId}/title`)
            .set("Authorization", `Bearer ${accessToken}`)
            .send({ title: "고친 제목" }),
        ),
      ]);

      // Then
      expect(deletion.status).toBe(200);
      for (const update of updates) {
        expect(update.status).toBeLessThan(500);
      }
      expect(await ctx.testDatabase.getClient().$count(todo, eq(todo.categoryId, categoryId))).toBe(
        0,
      );
    });
  });
});
