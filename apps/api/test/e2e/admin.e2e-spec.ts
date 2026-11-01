import { eq } from "drizzle-orm";
import request from "supertest";

import { DRIZZLE, type Database } from "#api/platform/database/database.client";
import { user as userTable } from "#api/platform/database/schema/index";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("관리자 E2E", () => {
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

  async function createAdminUser(email: string, password: string) {
    const user = await ctx.helpers.createVerifiedUser(email, password);
    const database = ctx.module.get<Database>(DRIZZLE);
    await database.update(userTable).set({ role: "ADMIN" }).where(eq(userTable.id, user.userId));
    const loginResult = await ctx.helpers.loginUser(email, password);
    return { ...user, accessToken: loginResult.accessToken };
  }

  describe("관리자 알림 발송", () => {
    describe("POST /admin/notifications/broadcast — 브로드캐스트 알림", () => {
      it("관리자가 브로드캐스트 알림을 발송한다", async () => {
        // Given
        const adminUser = await createAdminUser("admin-e2e@example.com", "Test1234!");

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/admin/notifications/broadcast")
          .set("Authorization", `Bearer ${adminUser.accessToken}`)
          .send({
            title: "E2E 테스트 알림",
            body: "전체 사용자 알림입니다",
            targetFilter: "ALL",
            force: true,
          })
          .expect(201);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.totalTargets).toBeGreaterThanOrEqual(1);
        expect(response.body.data.successCount).toBeGreaterThanOrEqual(1);
      });

      it("비관리자가 호출하면 403을 반환한다", async () => {
        // Given
        const regularUser = await ctx.helpers.createVerifiedUser(
          "regular-e2e@example.com",
          "Test1234!",
        );

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/admin/notifications/broadcast")
          .set("Authorization", `Bearer ${regularUser.accessToken}`)
          .send({
            title: "권한 없는 알림",
            body: "이 요청은 실패해야 합니다",
            targetFilter: "ALL",
          })
          .expect(403);

        // Then
        expect(response.body.success).toBe(false);
      });

      it("인증 없이 호출하면 401을 반환한다", async () => {
        // Given

        // When
        await request(ctx.app.getHttpServer())
          .post("/v1/admin/notifications/broadcast")
          .send({
            title: "인증 없는 알림",
            body: "이 요청은 실패해야 합니다",
            targetFilter: "ALL",
          })
          .expect(401);

        // Then
      });
    });

    describe("POST /admin/notifications/targeted — 타겟 알림", () => {
      it("관리자가 타겟 알림을 발송한다", async () => {
        // Given
        const adminUser = await createAdminUser("admin-target@example.com", "Test1234!");
        const regularUser = await ctx.helpers.createVerifiedUser(
          "target-user@example.com",
          "Test1234!",
        );

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/admin/notifications/targeted")
          .set("Authorization", `Bearer ${adminUser.accessToken}`)
          .send({
            title: "타겟 알림 테스트",
            body: "지정 사용자 알림입니다",
            userIds: [regularUser.userId],
          })
          .expect(201);

        // Then
        expect(response.body.success).toBe(true);
        expect(response.body.data.totalTargets).toBe(1);
        expect(response.body.data.successCount).toBe(1);
      });
    });
  });
});
