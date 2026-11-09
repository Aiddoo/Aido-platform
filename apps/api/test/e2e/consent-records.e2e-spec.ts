import {
  consentResponseSchema,
  updateMarketingConsentResponseSchema,
  updateMarketingPushConsentResponseSchema,
} from "@aido/api";
import request from "supertest";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("가입 약관 기록·광고성 동의 결과 HTTP 계약", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);
  beforeEach(async () => {
    await ctx.reset();
  });
  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  function getConsent(accessToken: string) {
    return request(ctx.app.getHttpServer())
      .get("/v1/auth/consent")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
  }

  async function appleSignup(token: string, appVersion?: string) {
    ctx.fakeOAuthTokenVerifierService.setCustomProfile("apple", token, {
      id: `${token}-owner`,
      email: `${token}@example.com`,
      emailVerified: true,
    });
    const call = request(ctx.app.getHttpServer()).post("/v1/auth/apple/callback");
    const response = await (appVersion == null ? call : call.set("X-App-Version", appVersion))
      .send({ idToken: token })
      .expect(200);
    return response.body.data;
  }

  it.each([
    { name: "버전 헤더 없음", appVersion: undefined },
    { name: "1.14.2", appVersion: "1.14.2" },
    { name: "1.15.0", appVersion: "1.15.0" },
  ])(
    "$name 앱의 소셜 가입은 약관·개인정보 동의와 지금 약관 버전을 기록한다",
    async ({ appVersion }) => {
      // Given
      const signup = await appleSignup(`consent-social-${appVersion ?? "none"}`, appVersion);

      // When
      const consent = consentResponseSchema.parse((await getConsent(signup.accessToken)).body.data);

      // Then
      expect(signup.isNewUser).toBe(true);
      expect(consent.termsAgreedAt).not.toBeNull();
      expect(consent.privacyAgreedAt).toBe(consent.termsAgreedAt);
      expect(consent.agreedTermsVersion).toBe("1.0.0");
      expect(consent.marketingAgreedAt).toBeNull();
      expect(consent.marketingPushAgreedAt).toBeNull();
    },
  );

  it("이메일 가입은 동의한 약관 버전을 기록한다", async () => {
    // Given
    const user = await ctx.helpers.createVerifiedUser("consent-email@example.com", "Test1234!");

    // When
    const consent = consentResponseSchema.parse((await getConsent(user.accessToken)).body.data);

    // Then
    expect(consent.termsAgreedAt).not.toBeNull();
    expect(consent.agreedTermsVersion).toBe("1.0.0");
  });

  it("광고성 동의 철회 응답은 처리한 서버 시각을, 동의 응답은 동의 시각을 준다", async () => {
    // Given
    const user = await ctx.helpers.createVerifiedUser("consent-marketing@example.com", "Test1234!");
    const patch = (path: string, agreed: boolean) =>
      request(ctx.app.getHttpServer())
        .patch(path)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ agreed })
        .expect(200);

    // When
    const marketingAgreed = updateMarketingConsentResponseSchema.parse(
      (await patch("/v1/auth/consent/marketing", true)).body.data,
    );
    const marketingWithdrawn = updateMarketingConsentResponseSchema.parse(
      (await patch("/v1/auth/consent/marketing", false)).body.data,
    );
    const pushWithdrawn = updateMarketingPushConsentResponseSchema.parse(
      (await patch("/v1/auth/consent/marketing-push", false)).body.data,
    );

    // Then
    expect(marketingAgreed.marketingAgreedAt).not.toBeNull();
    expect(marketingAgreed.marketingWithdrawnAt).toBeNull();
    expect(marketingWithdrawn.marketingAgreedAt).toBeNull();
    expect(Date.parse(marketingWithdrawn.marketingWithdrawnAt ?? "")).toBeGreaterThanOrEqual(
      Date.parse(marketingAgreed.marketingAgreedAt ?? ""),
    );
    expect(pushWithdrawn).toMatchObject({ marketingPushAgreedAt: null });
    expect(pushWithdrawn.marketingPushWithdrawnAt).toEqual(expect.any(String));
  });
});
