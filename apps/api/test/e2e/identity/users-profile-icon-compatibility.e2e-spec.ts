import request from "supertest";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";

describe("프로필 아이콘 배포 버전 호환", () => {
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

  it.each([
    ["russian_blue", "scottish_fold"],
    ["cream_cat", "white_cat"],
    ["tuxedo_cat", "black_cat"],
  ])("새 아이콘 %s를 저장해도 기존 앱에는 %s로 응답한다", async (newIcon, oldIcon) => {
    // Given
    const user = await testContext.helpers.createVerifiedUser("cat@example.com", "Test1234!");
    const authorization = `Bearer ${user.accessToken}`;

    // When
    const updated = await request(testContext.app.getHttpServer())
      .patch("/v1/auth/profile")
      .set("Authorization", authorization)
      .set("X-App-Version", "1.10.1")
      .send({ profileImage: newIcon })
      .expect(200);
    const legacy = await request(testContext.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", authorization)
      .expect(200);
    const versioned = await request(testContext.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", authorization)
      .set("X-App-Version", "1.10.0")
      .expect(200);
    const renamed = await request(testContext.app.getHttpServer())
      .patch("/v1/auth/profile")
      .set("Authorization", authorization)
      .send({ name: "고양이" })
      .expect(200);
    const latest = await request(testContext.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", authorization)
      .set("X-App-Version", "1.10.1")
      .expect(200);

    // Then
    expect(updated.body.data.profileImage).toBe(newIcon);
    expect(legacy.body.data.profileImage).toBe(oldIcon);
    expect(versioned.body.data.profileImage).toBe(oldIcon);
    expect(renamed.body.data.profileImage).toBe(oldIcon);
    expect(latest.body.data.profileImage).toBe(newIcon);
    expect(latest.body.data.name).toBe("고양이");
    expect(latest.headers.vary).toContain("X-App-Version");
  });
});
