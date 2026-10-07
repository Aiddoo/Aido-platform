/**
 * User Settings E2E 테스트
 *
 * @description
 * 사용자 설정(알림 환경설정, 동의 정보) API 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 시나리오:
 * 1. 알림 환경설정 조회/수정 (GET/PATCH /auth/preference)
 * 2. 동의 정보 조회 (GET /auth/consent)
 * 3. 마케팅 동의 수정 (PATCH /auth/consent/marketing)
 *
 * 실행 명령:
 * pnpm --filter @aido/server test:e2e -- user-settings.e2e-spec
 */

import { USER_PREFERENCE_DEFAULTS } from "@aido/api";
import request from "supertest";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("사용자 설정 E2E", () => {
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

  describe("알림 환경설정", () => {
    describe("GET /auth/preference - 환경설정 조회", () => {
      it("사용자의 환경설정을 조회한다", async () => {
        // Given - 인증된 사용자
        const user = await ctx.helpers.createVerifiedUser("settings-pref@example.com", "Test1234!");

        // When - 환경설정 조회 API 호출
        const response = await request(ctx.app.getHttpServer())
          .get("/v1/auth/preference")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then - 환경설정 응답 검증
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty("pushEnabled");
        expect(response.body.data).toHaveProperty("timezone");
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // Given - 인증 토큰 없음

        // When - 인증 없이 환경설정 조회 API 호출
        await request(ctx.app.getHttpServer()).get("/v1/auth/preference").expect(401);

        // Then - 401 Unauthorized 응답 확인 (expect에서 검증)
      });
    });

    describe("PATCH /auth/preference - 환경설정 수정", () => {
      it("푸시 알림 설정을 변경한다", async () => {
        // Given - 인증된 사용자
        const user = await ctx.helpers.createVerifiedUser("settings-push@example.com", "Test1234!");

        // When - 푸시 알림 비활성화
        const response = await request(ctx.app.getHttpServer())
          .patch("/v1/auth/preference")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ pushEnabled: false })
          .expect(200);

        // Then - 설정 변경 성공 검증
        expect(response.body.success).toBe(true);
      });

      it("타임존을 변경한다", async () => {
        // Given - 인증된 사용자
        const user = await ctx.helpers.createVerifiedUser("settings-tz@example.com", "Test1234!");

        // When - 타임존 변경
        const response = await request(ctx.app.getHttpServer())
          .patch("/v1/auth/preference")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ timezone: "Asia/Seoul" })
          .expect(200);

        // Then - 설정 변경 성공 검증
        expect(response.body.success).toBe(true);
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // Given - 인증 토큰 없음

        // When - 인증 없이 환경설정 수정 API 호출
        await request(ctx.app.getHttpServer())
          .patch("/v1/auth/preference")
          .send({ pushEnabled: false })
          .expect(401);

        // Then - 401 Unauthorized 응답 확인 (expect에서 검증)
      });
    });
  });

  describe("설정 저장과 캐시 정합성", () => {
    it("설정 행이 없는 기존 사용자의 첫 날씨 수정에서 false와 분 단위를 저장한다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser(
        "settings-first-weather@example.com",
        "Test1234!",
      );
      const table = ctx.testDatabase.getClient().orm.public.UserPreference;
      await table.where((row) => row.userId.eq(user.userId)).deleteAndCount();
      const weather = {
        weatherMorningEnabled: false,
        weatherMorningHour: 9,
        weatherMorningMinute: 37,
        weatherEveningEnabled: false,
        weatherEveningHour: 22,
        weatherEveningMinute: 43,
      };

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch("/v1/auth/preference")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send(weather)
        .expect(200);
      const reloaded = await request(ctx.app.getHttpServer())
        .get("/v1/auth/preference")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);

      // Then
      expect(response.body.data).toMatchObject(weather);
      expect(reloaded.body.data).toMatchObject(weather);
      expect(await table.where((row) => row.userId.eq(user.userId)).first()).toMatchObject(weather);
    });

    it("부분 수정의 false와 0을 저장하고 생략한 날씨 필드와 streak는 보존한다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser(
        "settings-partial-weather@example.com",
        "Test1234!",
      );
      const table = ctx.testDatabase.getClient().orm.public.UserPreference;
      await table
        .where((row) => row.userId.eq(user.userId))
        .update({
          weatherMorningHour: 9,
          weatherMorningMinute: 37,
          weatherEveningHour: 22,
          weatherEveningMinute: 43,
          currentStreak: 2,
          longestStreak: 4,
        });

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch("/v1/auth/preference")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ weatherMorningEnabled: false, weatherMorningMinute: 0 })
        .expect(200);

      // Then
      expect(response.body.data).toMatchObject({
        weatherMorningEnabled: false,
        weatherMorningHour: 9,
        weatherMorningMinute: 0,
        weatherEveningHour: 22,
        weatherEveningMinute: 43,
      });
      expect(await table.where((row) => row.userId.eq(user.userId)).first()).toMatchObject({
        currentStreak: 2,
        longestStreak: 4,
      });
    });

    it("타임존 헤더로 저장이 끝나면 이미 조회한 설정 캐시에도 변경이 반영된다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser(
        "settings-timezone-heal@example.com",
        "Test1234!",
      );
      const table = ctx.testDatabase.getClient().orm.public.UserPreference;
      const warm = await request(ctx.app.getHttpServer())
        .get("/v1/auth/preference")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);
      expect(warm.body.data.timezone).toBe("UTC");

      // When
      await request(ctx.app.getHttpServer())
        .get("/v1/auth/preference")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", "Asia/Seoul")
        .expect(200);
      await expect
        .poll(async () => {
          const reloaded = await request(ctx.app.getHttpServer())
            .get("/v1/auth/preference")
            .set("Authorization", `Bearer ${user.accessToken}`)
            .expect(200);
          return reloaded.body.data.timezone;
        })
        .toBe("Asia/Seoul");

      // Then
      expect(await table.where((row) => row.userId.eq(user.userId)).first()).toMatchObject({
        timezone: "Asia/Seoul",
      });
    });

    it("무료 사용자는 조회에서 리마인더 기본 시간을 받고 저장된 사용자 시간은 유지된다", async () => {
      // Given
      const user = await ctx.helpers.createVerifiedUser(
        "settings-premium-gate@example.com",
        "Test1234!",
      );
      const table = ctx.testDatabase.getClient().orm.public.UserPreference;
      await table
        .where((row) => row.userId.eq(user.userId))
        .update({ morningReminderHour: 6, morningReminderMinute: 37, weatherMorningMinute: 43 });

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/auth/preference")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);
      await request(ctx.app.getHttpServer())
        .patch("/v1/auth/preference")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ morningReminderHour: 7 })
        .expect(403);

      // Then
      expect(response.body.data).toMatchObject({
        morningReminderHour: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR,
        morningReminderMinute: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE,
        weatherMorningMinute: 43,
      });
      expect(await table.where((row) => row.userId.eq(user.userId)).first()).toMatchObject({
        morningReminderHour: 6,
        morningReminderMinute: 37,
      });
    });
  });

  describe("동의 정보", () => {
    describe("GET /auth/consent - 동의 정보 조회", () => {
      it("사용자의 동의 정보를 조회한다", async () => {
        // Given - 인증된 사용자
        const user = await ctx.helpers.createVerifiedUser(
          "settings-consent@example.com",
          "Test1234!",
        );

        // When - 동의 정보 조회 API 호출
        const response = await request(ctx.app.getHttpServer())
          .get("/v1/auth/consent")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .expect(200);

        // Then - 동의 정보 응답 검증
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty("termsAgreedAt");
        expect(response.body.data).toHaveProperty("privacyAgreedAt");
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // Given - 인증 토큰 없음

        // When - 인증 없이 동의 정보 조회 API 호출
        await request(ctx.app.getHttpServer()).get("/v1/auth/consent").expect(401);

        // Then - 401 Unauthorized 응답 확인 (expect에서 검증)
      });
    });

    describe("PATCH /auth/consent/marketing - 마케팅 동의 변경", () => {
      it("마케팅 동의를 활성화한다", async () => {
        // Given - 인증된 사용자
        const user = await ctx.helpers.createVerifiedUser(
          "settings-mkt-on@example.com",
          "Test1234!",
        );

        // When - 마케팅 동의 활성화
        const response = await request(ctx.app.getHttpServer())
          .patch("/v1/auth/consent/marketing")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ agreed: true })
          .expect(200);

        // Then - 동의 활성화 검증
        expect(response.body.success).toBe(true);
        expect(response.body.data.marketingAgreedAt).toBeDefined();
      });

      it("마케팅 동의를 철회한다", async () => {
        // Given - 마케팅 동의가 활성화된 사용자
        const user = await ctx.helpers.createVerifiedUser(
          "settings-mkt-off@example.com",
          "Test1234!",
        );
        await request(ctx.app.getHttpServer())
          .patch("/v1/auth/consent/marketing")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ agreed: true })
          .expect(200);

        // When - 마케팅 동의 철회
        const response = await request(ctx.app.getHttpServer())
          .patch("/v1/auth/consent/marketing")
          .set("Authorization", `Bearer ${user.accessToken}`)
          .send({ agreed: false })
          .expect(200);

        // Then - 동의 철회 검증
        expect(response.body.success).toBe(true);
        expect(response.body.data.marketingAgreedAt).toBeNull();
      });

      it("인증 없이 요청 시 401 에러 반환", async () => {
        // Given - 인증 토큰 없음

        // When - 인증 없이 마케팅 동의 변경 API 호출
        await request(ctx.app.getHttpServer())
          .patch("/v1/auth/consent/marketing")
          .send({ agreed: true })
          .expect(401);

        // Then - 401 Unauthorized 응답 확인 (expect에서 검증)
      });
    });
  });
});
