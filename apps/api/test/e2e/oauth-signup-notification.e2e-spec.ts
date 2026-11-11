import request from "supertest";

import { AuthRegistrationNotifierPort } from "#api/modules/identity/auth/application/ports/auth-collaboration.port";
import { StubAuthRegistrationNotifier } from "#test/mocks/ports/auth-credentials.stub";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const APP_HEADERS = {
  "X-App-Version": "1.14.2",
  "X-App-Build": "214",
  "X-Device-Type": "IOS",
  "X-Device-Name": "iPhone 18 Pro",
  "X-OS-Version": "27.1",
  "X-Timezone": "Asia/Seoul",
  "Accept-Language": "ko",
} as const;
const BROWSER_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) Safari/604.1";

describe("소셜 가입 관리자 알림 E2E", () => {
  let ctx: E2eTestContext;
  const notifier = new StubAuthRegistrationNotifier();

  beforeAll(async () => {
    ctx = await createE2eApp({
      customizeBuilder: (builder) =>
        builder.overrideProvider(AuthRegistrationNotifierPort).useValue(notifier),
      additionalResetters: [
        () => {
          notifier.notifications.length = 0;
        },
      ],
    });
  }, 60_000);

  beforeEach(async () => {
    await ctx.reset();
  });

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  async function finishWebCallback(providerAccountId: string, state: string): Promise<string> {
    const authorizationCode = `${providerAccountId}-code`;
    const token = `${providerAccountId}-token`;
    ctx.fakeOAuthProviderRegistry.setExchangeToken("KAKAO", authorizationCode, token);
    ctx.fakeOAuthTokenVerifierService.setCustomProfile("kakao", token, {
      id: providerAccountId,
      email: `${providerAccountId}@test.com`,
      emailVerified: true,
      name: "웹 가입자",
    });
    await request(ctx.app.getHttpServer())
      .get("/v1/auth/kakao/start")
      .query({ state, redirect_uri: "aido://auth/callback" })
      .expect(302);
    const callback = await request(ctx.app.getHttpServer())
      .get("/v1/auth/kakao/web-callback")
      .set("User-Agent", BROWSER_USER_AGENT)
      .query({ code: authorizationCode, state })
      .expect(302);
    return new URL(callback.headers.location ?? "").searchParams.get("code") ?? "";
  }

  it("웹 가입 알림은 콜백이 아니라 교환 요청에서 앱 헤더와 함께 한 번 나간다", async () => {
    // Given
    const code = await finishWebCallback("kakao-signup", "signup-state");
    const notificationsAfterCallback = [...notifier.notifications];
    // When
    const exchanged = await request(ctx.app.getHttpServer())
      .post("/v1/auth/exchange")
      .set(APP_HEADERS)
      .send({ code })
      .expect(200);
    await request(ctx.app.getHttpServer())
      .post("/v1/auth/exchange")
      .set(APP_HEADERS)
      .send({ code })
      .expect(401);
    // Then
    expect(notificationsAfterCallback).toEqual([]);
    expect(exchanged.body.data.isNewUser).toBe(true);
    expect(notifier.notifications).toEqual([
      expect.objectContaining({
        userId: exchanged.body.data.userId,
        email: "kakao-signup@test.com",
        provider: "kakao",
        name: "웹 가입자",
        devicePlatform: "IOS",
        deviceModel: "iPhone 18 Pro",
        osVersion: "27.1",
        appVersion: "1.14.2",
        appBuild: "214",
        locale: "ko",
        timezone: "Asia/Seoul",
      }),
    ]);
  });

  it("기존 사용자의 웹 로그인은 교환해도 알림을 보내지 않는다", async () => {
    // Given
    const firstCode = await finishWebCallback("kakao-returning", "first-state");
    await request(ctx.app.getHttpServer())
      .post("/v1/auth/exchange")
      .set(APP_HEADERS)
      .send({ code: firstCode })
      .expect(200);
    notifier.notifications.length = 0;
    const secondCode = await finishWebCallback("kakao-returning", "second-state");
    // When
    const exchanged = await request(ctx.app.getHttpServer())
      .post("/v1/auth/exchange")
      .set(APP_HEADERS)
      .send({ code: secondCode })
      .expect(200);
    // Then
    expect(exchanged.body.data.isNewUser).toBe(false);
    expect(notifier.notifications).toEqual([]);
  });

  it("앱이 직접 보내는 네이티브 콜백은 그 요청의 앱 헤더로 알림을 보낸다", async () => {
    // Given
    ctx.fakeOAuthTokenVerifierService.setCustomProfile("google", "native-token", {
      id: "google-native-signup",
      email: "google-native@test.com",
      emailVerified: true,
      name: "네이티브 가입자",
    });
    // When
    const response = await request(ctx.app.getHttpServer())
      .post("/v1/auth/google/callback")
      .set(APP_HEADERS)
      .send({ idToken: "native-token" });
    // Then
    expect(response.status).toBe(200);
    expect(notifier.notifications).toEqual([
      expect.objectContaining({
        email: "google-native@test.com",
        provider: "google",
        appVersion: "1.14.2",
      }),
    ]);
  });
});
