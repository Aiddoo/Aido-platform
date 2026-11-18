import { eq } from "drizzle-orm";
import request from "supertest";

import { DRIZZLE, type Database } from "#api/platform/database/database.client";
import { user as userTable } from "#api/platform/database/schema/index";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";

describe("GET /v1/admin/growth/summary — 관리자 성장 지표 E2E", () => {
  let testContext: E2eTestContext;

  beforeAll(async () => {
    testContext = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  beforeEach(async () => {
    await testContext.reset();
  });

  async function createAdminUser(email: string, password: string) {
    const user = await testContext.helpers.createVerifiedUser(email, password);
    const database = testContext.module.get<Database>(DRIZZLE);
    await database.update(userTable).set({ role: "ADMIN" }).where(eq(userTable.id, user.userId));
    const loginResult = await testContext.helpers.loginUser(email, password);
    return { ...user, accessToken: loginResult.accessToken };
  }

  it("활성 사용자 수와 함께 stickiness(DAU/MAU %)를 돌려준다", async () => {
    // Given
    const admin = await createAdminUser("admin-growth@example.com", "Test1234!");

    // When
    const response = await request(testContext.app.getHttpServer())
      .get("/v1/admin/growth/summary")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    // Then
    expect(response.body.data).toEqual(
      expect.objectContaining({
        dau: expect.any(Number),
        mau: expect.any(Number),
        stickiness: expect.any(Number),
      }),
    );
  });

  it("비관리자가 호출하면 403을 반환한다", async () => {
    // Given
    await testContext.helpers.createVerifiedUser("member-growth@example.com", "Test1234!");
    const { accessToken } = await testContext.helpers.loginUser(
      "member-growth@example.com",
      "Test1234!",
    );

    // When
    const response = await request(testContext.app.getHttpServer())
      .get("/v1/admin/growth/summary")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);

    // Then
    expect(response.body.error.code).toBe("ADMIN_1401");
  });
});
