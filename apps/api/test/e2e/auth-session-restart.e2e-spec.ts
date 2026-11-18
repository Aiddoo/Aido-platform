import request from "supertest";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
  restartE2eAppPreservingDatabase,
} from "#test/e2e/helpers/e2e-app-factory";

describe("인증 세션 재시작 내구성 E2E", () => {
  let testContext: E2eTestContext;

  beforeAll(async () => {
    testContext = await createE2eApp();
  });

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  it("재시작 전 access/refresh token을 재시작 후에도 사용할 수 있다", async () => {
    // Given
    const email = "restart-session@example.com";
    const password = "Test1234!";
    await testContext.helpers.createVerifiedUser(email, password);
    const tokens = await testContext.helpers.loginUser(email, password);

    // When
    testContext = await restartE2eAppPreservingDatabase(testContext);

    // Then
    await request(testContext.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .expect(200);

    const refreshResponse = await request(testContext.app.getHttpServer())
      .post("/v1/auth/refresh")
      .set("Authorization", `Bearer ${tokens.refreshToken}`)
      .expect(200);
    expect(refreshResponse.body.data.accessToken).toBeDefined();
    expect(refreshResponse.body.data.refreshToken).toBeDefined();
  });
});
