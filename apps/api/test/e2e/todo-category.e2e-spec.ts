/**
 * TodoCategory E2E 테스트
 *
 * @description
 * TodoCategory CRUD 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */
import { friendTodoListResponseSchema } from "@aido/api";
import { eq } from "drizzle-orm";
import request from "supertest";
import { z } from "zod";

import { user as userTable } from "#api/platform/database/schema/index";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("할 일 카테고리 E2E", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  /**
   * 프리미엄 유저 생성 헬퍼
   */
  async function createPremiumUser(email: string, password: string) {
    const user = await ctx.helpers.createVerifiedUser(email, password);
    const db = ctx.testDatabase.getClient();
    await db
      .update(userTable)
      .set({ subscriptionStatus: "ACTIVE" })
      .where(eq(userTable.id, user.userId));
    return user;
  }

  describe("기본 카테고리 생성", () => {
    it("회원가입 시 기본 카테고리 2개가 자동 생성된다", async () => {
      // Given

      // When
      const { accessToken } = await ctx.helpers.createVerifiedUser(
        "category-default@example.com",
        "Test1234!",
      );

      // Then
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.items).toHaveLength(2);

      const categories = response.body.data.items;
      const categoryNames = categories.map((c: { name: string }) => c.name);

      expect(categoryNames).toContain("중요한 일");
      expect(categoryNames).toContain("할 일");

      const importantCategory = categories.find((c: { name: string }) => c.name === "중요한 일");
      const todoCategory = categories.find((c: { name: string }) => c.name === "할 일");

      expect(importantCategory.color).toBe("#FFB3B3");
      expect(todoCategory.color).toBe("#FF6B43");
    });
  });

  describe("카테고리 CRUD 플로우", () => {
    const testPassword = "Test1234!";

    it("카테고리 생성 → 조회 → 수정 → 삭제 전체 플로우", async () => {
      // Given
      const { accessToken } = await createPremiumUser("category-crud@example.com", testPassword);

      // When
      const createResponse = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "공부",
          color: "#00FF00",
        })
        .expect(201);

      // Then
      expect(createResponse.body.data.message).toBe("카테고리가 생성되었습니다.");
      expect(createResponse.body.data.category).toMatchObject({
        name: "공부",
        color: "#00FF00",
      });
      expect(createResponse.body.data.category.id).toBeDefined();

      const createdCategoryId = createResponse.body.data.category.id;

      // When
      const listResponse = await request(ctx.app.getHttpServer())
        .get("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      // Then
      expect(listResponse.body.data.items).toBeDefined();
      expect(Array.isArray(listResponse.body.data.items)).toBe(true);
      expect(listResponse.body.data.items.length).toBe(3);

      for (const category of listResponse.body.data.items) {
        expect(category.todoCount).toBeDefined();
        expect(typeof category.todoCount).toBe("number");
      }

      const sortOrders = listResponse.body.data.items.map(
        (c: { sortOrder: number }) => c.sortOrder,
      );
      const isSorted = sortOrders.every((val: number, i: number, arr: number[]) => {
        const prev = arr[i - 1];
        return i === 0 || (prev !== undefined && prev <= val);
      });
      expect(isSorted).toBe(true);

      // When
      const detailResponse = await request(ctx.app.getHttpServer())
        .get(`/v1/todo-categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      // Then
      expect(detailResponse.body.data.category.id).toBe(createdCategoryId);
      expect(detailResponse.body.data.category.name).toBe("공부");
      expect(detailResponse.body.data.category.todoCount).toBeDefined();

      // When
      const updateNameResponse = await request(ctx.app.getHttpServer())
        .patch(`/v1/todo-categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "수정된 카테고리" })
        .expect(200);

      // Then
      expect(updateNameResponse.body.data.message).toBe("카테고리가 수정되었습니다.");
      expect(updateNameResponse.body.data.category.name).toBe("수정된 카테고리");

      // When
      const updateColorResponse = await request(ctx.app.getHttpServer())
        .patch(`/v1/todo-categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ color: "#0000FF" })
        .expect(200);

      // Then
      expect(updateColorResponse.body.data.category.color).toBe("#0000FF");

      // When
      const updateBothResponse = await request(ctx.app.getHttpServer())
        .patch(`/v1/todo-categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "최종 수정", color: "#AABBCC" })
        .expect(200);

      // Then
      expect(updateBothResponse.body.data.category.name).toBe("최종 수정");
      expect(updateBothResponse.body.data.category.color).toBe("#AABBCC");

      // When
      const deleteResponse = await request(ctx.app.getHttpServer())
        .delete(`/v1/todo-categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      // Then
      expect(deleteResponse.body.data.message).toBe("카테고리가 삭제되었습니다.");

      await request(ctx.app.getHttpServer())
        .get(`/v1/todo-categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);
    });

    it("중복된 이름으로 생성 시 409 에러", async () => {
      // Given
      const { accessToken } = await createPremiumUser("category-dup@example.com", testPassword);

      await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "공부", color: "#00FF00" })
        .expect(201);

      // When
      const response = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "공부", color: "#FF0000" })
        .expect(409);

      // Then
      expect(response.body.error.code).toBe("TODO_CATEGORY_0853");
    });

    it("이름 누락 시 400 에러", async () => {
      // Given
      const { accessToken } = await createPremiumUser("category-noname@example.com", testPassword);

      // When
      await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ color: "#00FF00" })
        .expect(400);

      // Then
    });

    it("색상 누락 시 400 에러", async () => {
      // Given
      const { accessToken } = await createPremiumUser("category-nocolor@example.com", testPassword);

      // When
      await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "새 카테고리" })
        .expect(400);

      // Then
    });

    it("잘못된 색상 형식 시 400 에러", async () => {
      // Given
      const { accessToken } = await createPremiumUser(
        "category-badcolor@example.com",
        testPassword,
      );

      // When
      await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "테스트", color: "not-a-color" })
        .expect(400);

      // Then
    });

    it("인증 없이 생성 시 401 에러", async () => {
      // Given

      // When
      await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .send({ name: "테스트", color: "#000000" })
        .expect(401);

      // Then
    });

    it("존재하지 않는 ID로 조회 시 404 에러", async () => {
      // Given
      const { accessToken } = await createPremiumUser("category-404@example.com", testPassword);

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/todo-categories/999999")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);

      // Then
      expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
    });

    it("인증 없이 조회 시 401 에러", async () => {
      // Given

      // When
      await request(ctx.app.getHttpServer()).get("/v1/todo-categories").expect(401);

      // Then
    });

    it("중복된 이름으로 수정 시 409 에러", async () => {
      // Given
      const { accessToken } = await createPremiumUser(
        "category-dupupdate@example.com",
        testPassword,
      );

      const createResponse = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "공부", color: "#00FF00" })
        .expect(201);

      const createdCategoryId = createResponse.body.data.category.id;

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch(`/v1/todo-categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "중요한 일" })
        .expect(409);

      // Then
      expect(response.body.error.code).toBe("TODO_CATEGORY_0853");
    });

    it("존재하지 않는 ID로 수정 시 404 에러", async () => {
      // Given
      const { accessToken } = await createPremiumUser(
        "category-update404@example.com",
        testPassword,
      );

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch("/v1/todo-categories/999999")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "테스트" })
        .expect(404);

      // Then
      expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
    });

    it("인증 없이 수정 시 401 에러", async () => {
      // Given

      // When
      await request(ctx.app.getHttpServer())
        .patch("/v1/todo-categories/1")
        .send({ name: "테스트" })
        .expect(401);

      // Then
    });

    it("인증 없이 상세 조회 시 401 에러", async () => {
      // Given

      // When
      await request(ctx.app.getHttpServer()).get("/v1/todo-categories/1").expect(401);

      // Then
    });
  });

  describe("카테고리 순서 변경", () => {
    const testPassword = "Test1234!";

    it("특정 카테고리 앞으로 이동 성공 (before)", async () => {
      // Given
      const { accessToken } = await createPremiumUser(
        "cat-reorder-before@example.com",
        testPassword,
      );

      const res1 = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "순서 테스트 1", color: "#111111" })
        .expect(201);
      const category1Id = res1.body.data.category.id;

      const _res2 = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "순서 테스트 2", color: "#222222" })
        .expect(201);

      const res3 = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "순서 테스트 3", color: "#333333" })
        .expect(201);
      const category3Id = res3.body.data.category.id;

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch(`/v1/todo-categories/${category3Id}/reorder`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          targetCategoryId: category1Id,
          position: "before",
        })
        .expect(200);

      // Then
      expect(response.body.data.message).toBe("카테고리 순서가 변경되었습니다.");
    });

    it("특정 카테고리 뒤로 이동 성공 (after)", async () => {
      // Given
      const { accessToken } = await createPremiumUser(
        "cat-reorder-after@example.com",
        testPassword,
      );

      const res1 = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "순서 테스트 1", color: "#111111" })
        .expect(201);
      const category1Id = res1.body.data.category.id;

      const res2 = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "순서 테스트 2", color: "#222222" })
        .expect(201);
      const category2Id = res2.body.data.category.id;

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch(`/v1/todo-categories/${category1Id}/reorder`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          targetCategoryId: category2Id,
          position: "after",
        })
        .expect(200);

      // Then
      expect(response.body.data.message).toBe("카테고리 순서가 변경되었습니다.");
    });

    it("맨 앞으로 이동 성공 (targetCategoryId 없이 before)", async () => {
      // Given
      const { accessToken } = await createPremiumUser(
        "cat-reorder-first@example.com",
        testPassword,
      );

      const res = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "순서 테스트", color: "#111111" })
        .expect(201);
      const categoryId = res.body.data.category.id;

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch(`/v1/todo-categories/${categoryId}/reorder`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ position: "before" })
        .expect(200);

      // Then
      expect(response.body.data.category.sortOrder).toBe(0);
    });

    it("맨 뒤로 이동 성공 (targetCategoryId 없이 after)", async () => {
      // Given
      const { accessToken } = await createPremiumUser("cat-reorder-last@example.com", testPassword);

      const res = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "순서 테스트", color: "#111111" })
        .expect(201);
      const categoryId = res.body.data.category.id;

      const beforeResponse = await request(ctx.app.getHttpServer())
        .get("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      const maxSortOrder = Math.max(
        ...beforeResponse.body.data.items.map((c: { sortOrder: number }) => c.sortOrder),
      );

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch(`/v1/todo-categories/${categoryId}/reorder`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ position: "after" })
        .expect(200);

      // Then
      expect(response.body.data.category.sortOrder).toBeGreaterThanOrEqual(maxSortOrder);
    });
  });

  describe("카테고리 삭제", () => {
    const testPassword = "Test1234!";

    it("Todo가 없는 카테고리 삭제 성공", async () => {
      // Given
      const { accessToken } = await createPremiumUser("cat-del-empty@example.com", testPassword);

      const res = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "삭제될 카테고리", color: "#FF0000" })
        .expect(201);
      const categoryToDelete = res.body.data.category.id;

      // When
      const response = await request(ctx.app.getHttpServer())
        .delete(`/v1/todo-categories/${categoryToDelete}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      // Then
      expect(response.body.data.message).toBe("카테고리가 삭제되었습니다.");

      await request(ctx.app.getHttpServer())
        .get(`/v1/todo-categories/${categoryToDelete}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);
    });

    it("Todo가 있는 카테고리 삭제 시 이동 대상 필요", async () => {
      // Given
      const { accessToken } = await createPremiumUser("cat-del-todos@example.com", testPassword);

      const catRes = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Todo 있는 카테고리", color: "#00FF00" })
        .expect(201);
      const categoryWithTodos = catRes.body.data.category.id;

      await request(ctx.app.getHttpServer())
        .post("/v1/todos")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "테스트 할 일",
          categoryId: categoryWithTodos,
          startDate: "2024-01-15",
        })
        .expect(201);

      // When
      const response = await request(ctx.app.getHttpServer())
        .delete(`/v1/todo-categories/${categoryWithTodos}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400);

      // Then
      expect(response.body.error.code).toBe("TODO_CATEGORY_0855");
    });

    it("moveToCategoryId가 삭제 대상과 같으면 400을 반환해야 한다", async () => {
      // Given
      const { accessToken } = await createPremiumUser("cat-del-self@example.com", testPassword);

      const catRes = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "셀프 이동 테스트", color: "#FF0000" })
        .expect(201);
      const categoryId = catRes.body.data.category.id;

      await request(ctx.app.getHttpServer())
        .post("/v1/todos")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "셀프 이동 할 일",
          categoryId,
          startDate: "2024-01-15",
        })
        .expect(201);

      // When
      const response = await request(ctx.app.getHttpServer())
        .delete(`/v1/todo-categories/${categoryId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ moveToCategoryId: categoryId })
        .expect(400);

      // Then
      expect(response.body.error.code).toBe("SYS_0002");
    });

    it("Todo가 있는 카테고리를 이동 대상과 함께 삭제 성공", async () => {
      // Given
      const { accessToken } = await createPremiumUser("cat-del-move@example.com", testPassword);

      const listRes = await request(ctx.app.getHttpServer())
        .get("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      const targetCategoryId = listRes.body.data.items[0].id;

      const catRes = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "이동 후 삭제", color: "#0000FF" })
        .expect(201);
      const categoryWithTodos = catRes.body.data.category.id;

      const todoRes = await request(ctx.app.getHttpServer())
        .post("/v1/todos")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "이동될 할 일",
          categoryId: categoryWithTodos,
          startDate: "2024-01-15",
        })
        .expect(201);
      const todoId = todoRes.body.data.todo.id;

      // When
      const response = await request(ctx.app.getHttpServer())
        .delete(`/v1/todo-categories/${categoryWithTodos}`)
        .query({ moveToCategoryId: targetCategoryId })
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      // Then
      expect(response.body.data.message).toBe("카테고리가 삭제되었습니다.");

      const todoResponse = await request(ctx.app.getHttpServer())
        .get(`/v1/todos/${todoId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(todoResponse.body.data.category.id).toBe(targetCategoryId);
    });

    it("마지막 카테고리 삭제 시 400 에러", async () => {
      // Given
      const { accessToken: newUserToken } = await ctx.helpers.createVerifiedUser(
        "last-category@example.com",
        testPassword,
      );

      const listRes = await request(ctx.app.getHttpServer())
        .get("/v1/todo-categories")
        .set("Authorization", `Bearer ${newUserToken}`)
        .expect(200);

      const categories = listRes.body.data.items;
      expect(categories).toHaveLength(2);

      // When
      await request(ctx.app.getHttpServer())
        .delete(`/v1/todo-categories/${categories[0].id}`)
        .set("Authorization", `Bearer ${newUserToken}`)
        .expect(200);

      // When
      const response = await request(ctx.app.getHttpServer())
        .delete(`/v1/todo-categories/${categories[1].id}`)
        .set("Authorization", `Bearer ${newUserToken}`)
        .expect(400);

      // Then
      expect(response.body.error.code).toBe("TODO_CATEGORY_0854");
    });

    it("존재하지 않는 ID로 삭제 시 404 에러", async () => {
      // Given
      const { accessToken } = await createPremiumUser("cat-del-404@example.com", testPassword);

      // When
      const response = await request(ctx.app.getHttpServer())
        .delete("/v1/todo-categories/999999")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);

      // Then
      expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
    });

    it("인증 없이 삭제 시 401 에러", async () => {
      // Given

      // When
      await request(ctx.app.getHttpServer()).delete("/v1/todo-categories/1").expect(401);

      // Then
    });
  });

  describe("사용자 격리 테스트", () => {
    const testPassword = "Test1234!";

    it("다른 사용자의 카테고리 조회 시 403 에러", async () => {
      // Given
      const user1 = await createPremiumUser("cat-user1-403@example.com", testPassword);
      const user2 = await createPremiumUser("cat-user2-403@example.com", testPassword);

      const response = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${user1.accessToken}`)
        .send({ name: "User1 카테고리", color: "#FF0000" })
        .expect(201);
      const user1CategoryId = response.body.data.category.id;

      // When
      const getResponse = await request(ctx.app.getHttpServer())
        .get(`/v1/todo-categories/${user1CategoryId}`)
        .set("Authorization", `Bearer ${user2.accessToken}`)
        .expect(403);

      // Then
      expect(getResponse.body.error.code).toBe("TODO_CATEGORY_0852");
    });

    it("다른 사용자의 카테고리 수정 시 404 에러", async () => {
      // Given
      const user1 = await createPremiumUser("cat-user1-patch@example.com", testPassword);
      const user2 = await createPremiumUser("cat-user2-patch@example.com", testPassword);

      const response = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${user1.accessToken}`)
        .send({ name: "User1 카테고리", color: "#FF0000" })
        .expect(201);
      const user1CategoryId = response.body.data.category.id;

      // When
      const patchResponse = await request(ctx.app.getHttpServer())
        .patch(`/v1/todo-categories/${user1CategoryId}`)
        .set("Authorization", `Bearer ${user2.accessToken}`)
        .send({ name: "해킹 시도" })
        .expect(404);

      // Then
      expect(patchResponse.body.error.code).toBe("TODO_CATEGORY_0851");
    });

    it("다른 사용자의 카테고리 삭제 시 404 에러", async () => {
      // Given
      const user1 = await createPremiumUser("cat-user1-del@example.com", testPassword);
      const user2 = await createPremiumUser("cat-user2-del@example.com", testPassword);

      const response = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${user1.accessToken}`)
        .send({ name: "User1 카테고리", color: "#FF0000" })
        .expect(201);
      const user1CategoryId = response.body.data.category.id;

      // When
      const delResponse = await request(ctx.app.getHttpServer())
        .delete(`/v1/todo-categories/${user1CategoryId}`)
        .set("Authorization", `Bearer ${user2.accessToken}`)
        .expect(404);

      // Then
      expect(delResponse.body.error.code).toBe("TODO_CATEGORY_0851");
    });

    it("같은 이름의 카테고리를 다른 사용자가 각각 생성 가능", async () => {
      // Given
      const user1 = await createPremiumUser("cat-user1-same@example.com", testPassword);
      const user2 = await createPremiumUser("cat-user2-same@example.com", testPassword);

      await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${user1.accessToken}`)
        .send({ name: "운동", color: "#00FF00" })
        .expect(201);

      // When
      const response = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${user2.accessToken}`)
        .send({ name: "운동", color: "#0000FF" })
        .expect(201);

      // Then
      expect(response.body.data.category.name).toBe("운동");
    });

    it("각 사용자는 자신의 카테고리만 목록에서 조회됨", async () => {
      // Given
      const user1 = await createPremiumUser("cat-user1-list@example.com", testPassword);
      const user2 = await createPremiumUser("cat-user2-list@example.com", testPassword);

      await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${user1.accessToken}`)
        .send({ name: "User1 카테고리", color: "#FF0000" })
        .expect(201);

      // When
      const user1List = await request(ctx.app.getHttpServer())
        .get("/v1/todo-categories")
        .set("Authorization", `Bearer ${user1.accessToken}`)
        .expect(200);

      // When
      const user2List = await request(ctx.app.getHttpServer())
        .get("/v1/todo-categories")
        .set("Authorization", `Bearer ${user2.accessToken}`)
        .expect(200);

      // Then
      const user1Names = user1List.body.data.items.map((c: { name: string }) => c.name);
      const user2Names = user2List.body.data.items.map((c: { name: string }) => c.name);

      expect(user1Names).toContain("User1 카테고리");
      expect(user2Names).not.toContain("User1 카테고리");
    });
  });

  describe("친구 화면 할 일 캐시", () => {
    it("카테고리 이름·색을 바꾸면 이미 할 일을 본 친구도 다음 조회에서 바로 새 이름·색을 본다", async () => {
      // Given
      const password = "Test1234!";
      const owner = await createPremiumUser("cat-friend-owner@example.com", password);
      const friend = await ctx.helpers.createVerifiedUser(
        "cat-friend-viewer@example.com",
        password,
      );
      await ctx.helpers.createFriendship(owner, friend);
      const categoryResponse = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ name: "공부", color: "#111111" })
        .expect(201);
      const categoryId = z.number().parse(categoryResponse.body.data.category.id);
      await request(ctx.app.getHttpServer())
        .post("/v1/todos")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ title: "공개 할 일", categoryId, startDate: "2027-01-15", visibility: "PUBLIC" })
        .expect(201);
      async function friendTodoCategories() {
        const response = await request(ctx.app.getHttpServer())
          .get(`/v1/todos/friends/${owner.userId}`)
          .set("Authorization", `Bearer ${friend.accessToken}`)
          .expect(200);
        return friendTodoListResponseSchema
          .parse(response.body.data)
          .items.map(({ category }) => ({ name: category.name, color: category.color }));
      }
      expect(await friendTodoCategories()).toEqual([{ name: "공부", color: "#111111" }]);

      // When
      await request(ctx.app.getHttpServer())
        .patch(`/v1/todo-categories/${categoryId}`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ name: "운동", color: "#222222" })
        .expect(200);

      // Then
      expect(await friendTodoCategories()).toEqual([{ name: "운동", color: "#222222" }]);
    });
  });
});
