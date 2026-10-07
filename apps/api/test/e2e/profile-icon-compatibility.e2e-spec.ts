import request from "supertest";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("프로필 아이콘 배포 버전 호환", () => {
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

  it.each([
    ["russian_blue", "scottish_fold"],
    ["cream_cat", "white_cat"],
    ["tuxedo_cat", "black_cat"],
  ])("새 아이콘 %s를 저장해도 기존 앱에는 %s로 응답한다", async (newIcon, oldIcon) => {
    // Given
    const user = await ctx.helpers.createVerifiedUser("cat@example.com", "Test1234!");
    const authorization = `Bearer ${user.accessToken}`;

    // When
    const updated = await request(ctx.app.getHttpServer())
      .patch("/v1/auth/profile")
      .set("Authorization", authorization)
      .set("X-App-Version", "1.10.1")
      .send({ profileImage: newIcon })
      .expect(200);
    const legacy = await request(ctx.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", authorization)
      .expect(200);
    const versioned = await request(ctx.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", authorization)
      .set("X-App-Version", "1.10.0")
      .expect(200);
    const renamed = await request(ctx.app.getHttpServer())
      .patch("/v1/auth/profile")
      .set("Authorization", authorization)
      .send({ name: "고양이" })
      .expect(200);
    const latest = await request(ctx.app.getHttpServer())
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
