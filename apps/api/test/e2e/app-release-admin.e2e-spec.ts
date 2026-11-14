import { publishAppReleaseResponseSchema } from "@aido/api/contracts/app-config";
import { ErrorCode } from "@aido/api/errors";
import { eq } from "drizzle-orm";
import request from "supertest";

import { DRIZZLE, type Database } from "#api/platform/database/database.client";
import { user as userTable } from "#api/platform/database/schema/index";

import { releasedAppVersionResponseSchema } from "./fixtures/released-app-config-response.schema.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("스토어 공개 버전 반영 (E2E)", () => {
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

  function server() {
    return request(ctx.app.getHttpServer());
  }

  async function createAdminAccessToken(): Promise<string> {
    const email = "app-release-admin@example.com";
    const password = "Test1234!";
    const user = await ctx.helpers.createVerifiedUser(email, password);
    const database = ctx.module.get<Database>(DRIZZLE);
    await database.update(userTable).set({ role: "ADMIN" }).where(eq(userTable.id, user.userId));
    return (await ctx.helpers.loginUser(email, password)).accessToken;
  }

  it("관리자가 두 플랫폼을 반영하면 재시작 없이 공개 조회가 그 값을 출시 앱 모양으로 돌려준다", async () => {
    // Given
    const accessToken = await createAdminAccessToken();
    const before = await server().get("/v1/app-config/app-version").expect(200);

    // When
    const ios = await server()
      .put("/v1/admin/app-config/app-releases/ios")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ latestVersion: "1.15.2" })
      .expect(200);
    const afterIosOnly = await server().get("/v1/app-config/app-version").expect(200);
    await server()
      .put("/v1/admin/app-config/app-releases/android")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ latestVersion: "1.15.1" })
      .expect(200);
    const afterBoth = await server().get("/v1/app-config/app-version").expect(200);

    // Then
    expect(publishAppReleaseResponseSchema.parse(ios.body.data).appRelease).toMatchObject({
      platform: "ios",
      latestVersion: "1.15.2",
    });
    expect(before.body).toEqual({ enabled: false });
    expect(afterIosOnly.body).toEqual({ enabled: false });
    expect(releasedAppVersionResponseSchema.safeParse(afterBoth.body)).toEqual({
      success: true,
      data: {
        enabled: true,
        ios: { latestVersion: "1.15.2" },
        android: { latestVersion: "1.15.1" },
      },
    });
  });

  it("관리자가 아니면 403 ADMIN_1401, 로그인하지 않으면 401이고 값은 바뀌지 않는다", async () => {
    // Given
    const regularUser = await ctx.helpers.createVerifiedUser(
      "app-release-user@example.com",
      "Test1234!",
    );

    // When
    const forbidden = await server()
      .put("/v1/admin/app-config/app-releases/ios")
      .set("Authorization", `Bearer ${regularUser.accessToken}`)
      .send({ latestVersion: "1.15.2" })
      .expect(403);
    await server()
      .put("/v1/admin/app-config/app-releases/ios")
      .send({ latestVersion: "1.15.2" })
      .expect(401);
    const published = await server().get("/v1/app-config/app-version").expect(200);

    // Then
    expect(forbidden.body.error.code).toBe(ErrorCode.ADMIN_1401);
    expect(published.body).toEqual({ enabled: false });
  });

  it.each([
    { platform: "ios", latestVersion: "1.15.2-rc.1" },
    { platform: "web", latestVersion: "1.15.2" },
  ])(
    "플랫폼·버전 모양이 틀리면($platform, $latestVersion) 400 SYS_0002다",
    async ({ platform, latestVersion }) => {
      // Given
      const accessToken = await createAdminAccessToken();

      // When
      const response = await server()
        .put(`/v1/admin/app-config/app-releases/${platform}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ latestVersion })
        .expect(400);

      // Then
      expect(response.body.error.code).toBe(ErrorCode.SYS_0002);
    },
  );
});
