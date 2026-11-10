import { PLAN_CATALOG, quotaErrorDetailsSchema } from "@aido/api";
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

import { todoCategory, user as userTable } from "#api/platform/database/schema/index";
import { nowInstant } from "#test/fixtures/clock.fixture";

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
      expect(quotaErrorDetailsSchema.parse(overResponse.body.error.details)).toEqual({
        charged: false,
        featureQuota: {
          feature: "TODO_CATEGORY",
          allowed: true,
          limit: FREE_LIMIT,
          used: FREE_LIMIT,
          remaining: 0,
          period: null,
          resetsAt: null,
          isFairUse: false,
          perUse: null,
        },
      });

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

  describe("ADMIN은 프리미엄 한도", () => {
    const PREMIUM_LIMIT = PLAN_CATALOG.TODO_CATEGORY.premium;

    it("한도보다 많이 가진 ADMIN은 목록·수정·순서 변경은 그대로 하고 새로 만들기만 프리미엄 한도로 막힌다", async () => {
      // Given - 기본 2개에 더해 프리미엄 한도를 하나 넘게 가진 ADMIN
      const admin = await ctx.helpers.createVerifiedUser("cat-limit-admin@test.com", password);
      const client = ctx.testDatabase.getClient();
      await client.update(userTable).set({ role: "ADMIN" }).where(eq(userTable.id, admin.userId));
      await client.insert(todoCategory).values(
        Array.from({ length: PREMIUM_LIMIT - 1 }, (_, index) => ({
          userId: admin.userId,
          name: `관리자 카테고리 ${index + 1}`,
          color: "#123456",
          sortOrder: 100 + index,
          updatedAt: nowInstant(),
        })),
      );
      const owned = PREMIUM_LIMIT + 1;
      const server = ctx.app.getHttpServer();
      const authorization = `Bearer ${admin.accessToken}`;

      // When
      const list = await request(server)
        .get("/v1/todo-categories")
        .set("Authorization", authorization);
      const firstId: unknown = list.body.data.items[0]?.id;
      const lastId: unknown = list.body.data.items.at(-1)?.id;
      const renamed = await request(server)
        .patch(`/v1/todo-categories/${String(firstId)}`)
        .set("Authorization", authorization)
        .send({ name: "이름 바꾼 카테고리" });
      const reordered = await request(server)
        .patch(`/v1/todo-categories/${String(lastId)}/reorder`)
        .set("Authorization", authorization)
        .send({ position: "before" });
      const created = await request(server)
        .post("/v1/todo-categories")
        .set("Authorization", authorization)
        .send({ name: "한도 넘는 카테고리", color: "#0000FF" });
      const limit = await request(server)
        .get("/v1/todo-categories/resource-limit")
        .set("Authorization", authorization);

      // Then
      expect(list.status).toBe(200);
      expect(list.body.data.items).toHaveLength(owned);
      expect(renamed.status).toBe(200);
      expect(reordered.status).toBe(200);
      expect(created.status).toBe(403);
      expect(created.body.error.code).toBe("TODO_CATEGORY_0857");
      expect(quotaErrorDetailsSchema.parse(created.body.error.details).featureQuota).toMatchObject({
        feature: "TODO_CATEGORY",
        limit: PREMIUM_LIMIT,
        used: owned,
        remaining: 0,
      });
      expect(limit.body.data).toMatchObject({ maxCount: PREMIUM_LIMIT, categoryCount: owned });
    });
  });
});
