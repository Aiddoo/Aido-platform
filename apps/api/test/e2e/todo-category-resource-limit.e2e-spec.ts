import { PLAN_CATALOG } from "@aido/api";
import { eq } from "drizzle-orm";
import request from "supertest";
/**
 * TodoCategory 리소스 제한 E2E 테스트
 *
 * @description
 * Free 유저의 카테고리 3개 제한 테스트.
 * 회원가입 시 기본 카테고리 2개가 자동 생성되므로, 1개만 추가하면 한도에 도달합니다.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import { user as userTable } from "#api/platform/database/schema/index";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const FREE_LIMIT = PLAN_CATALOG.TODO_CATEGORY.free;

describe("할 일 카테고리 리소스 제한 E2E", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  const password = "Test1234!";

  describe("Free 유저 카테고리 제한", () => {
    it("3번째 카테고리 생성 성공 후 4번째 생성 시 403 에러, 리소스 제한 조회 확인", async () => {
      // Given - 기본 카테고리 2개가 자동 생성된 Free 유저
      const user = await ctx.helpers.createVerifiedUser("cat-limit-free@test.com", password);
      const accessToken = user.accessToken;

      // When - 3번째 카테고리 생성
      const createResponse = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "추가 카테고리", color: "#00FF00" })
        .expect(201);

      // Then - 카테고리 생성 성공
      expect(createResponse.body.data.category.name).toBe("추가 카테고리");

      // When - 4번째 카테고리 생성 시도
      const overResponse = await request(ctx.app.getHttpServer())
        .post("/v1/todo-categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "초과 카테고리", color: "#0000FF" })
        .expect(403);

      // Then - 403 에러와 TODO_CATEGORY_0857 코드 반환
      expect(overResponse.body.success).toBe(false);
      expect(overResponse.body.error.code).toBe("TODO_CATEGORY_0857");

      // When - 리소스 제한 조회
      const limitResponse = await request(ctx.app.getHttpServer())
        .get("/v1/todo-categories/resource-limit")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      // Then - 현재 카테고리 수와 한도가 FREE_LIMIT과 일치
      expect(limitResponse.body.data.categoryCount).toBe(FREE_LIMIT);
      expect(limitResponse.body.data.maxCount).toBe(FREE_LIMIT);
    });
  });

  describe("Premium 유저 무제한", () => {
    it("Free 한도(3개)를 초과하여 카테고리 생성 성공하고 maxCount가 ACTIVE 구독 한도", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser("cat-limit-premium@test.com", password);
      const accessToken = user.accessToken;
      await ctx.testDatabase
        .getClient()
        .update(userTable)
        .set({ subscriptionStatus: "ACTIVE" })
        .where(eq(userTable.id, user.userId));

      // When
      for (let i = 1; i <= 3; i++) {
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/todo-categories")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ name: `프리미엄 카테고리 ${i}`, color: "#FF0000" })
          .expect(201);

        // Then
        expect(response.body.data.category.name).toBe(`프리미엄 카테고리 ${i}`);
      }

      // When
      const limitResponse = await request(ctx.app.getHttpServer())
        .get("/v1/todo-categories/resource-limit")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      // Then
      expect(limitResponse.body.data.maxCount).toBe(PLAN_CATALOG.TODO_CATEGORY.premium);
      expect(limitResponse.body.data.categoryCount).toBe(5);
    });
  });
});
