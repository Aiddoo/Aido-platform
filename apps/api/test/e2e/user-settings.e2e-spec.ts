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
 * pnpm --filter @aido/api test:e2e -- user-settings.e2e-spec
 */

import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("사용자 설정 E2E", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	beforeEach(async () => {
		await ctx.testDatabase.cleanup();
		ctx.fakeEmailService.clear();
	});

	describe("알림 환경설정", () => {
		describe("GET /auth/preference - 환경설정 조회", () => {
			it("사용자의 환경설정을 조회한다", async () => {
				// Given - 인증된 사용자
				const user = await ctx.helpers.createVerifiedUser(
					"settings-pref@example.com",
					"Test1234!",
				);

				// When - 환경설정 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/auth/preference")
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
				await request(ctx.app.getHttpServer())
					.get("/auth/preference")
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("PATCH /auth/preference - 환경설정 수정", () => {
			it("푸시 알림 설정을 변경한다", async () => {
				// Given - 인증된 사용자
				const user = await ctx.helpers.createVerifiedUser(
					"settings-push@example.com",
					"Test1234!",
				);

				// When - 푸시 알림 비활성화
				const response = await request(ctx.app.getHttpServer())
					.patch("/auth/preference")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({ pushEnabled: false })
					.expect(200);

				// Then - 설정 변경 성공 검증
				expect(response.body.success).toBe(true);
			});

			it("타임존을 변경한다", async () => {
				// Given - 인증된 사용자
				const user = await ctx.helpers.createVerifiedUser(
					"settings-tz@example.com",
					"Test1234!",
				);

				// When - 타임존 변경
				const response = await request(ctx.app.getHttpServer())
					.patch("/auth/preference")
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
					.patch("/auth/preference")
					.send({ pushEnabled: false })
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
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
					.get("/auth/consent")
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
				await request(ctx.app.getHttpServer()).get("/auth/consent").expect(401);

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
					.patch("/auth/consent/marketing")
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
					.patch("/auth/consent/marketing")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({ agreed: true })
					.expect(200);

				// When - 마케팅 동의 철회
				const response = await request(ctx.app.getHttpServer())
					.patch("/auth/consent/marketing")
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
					.patch("/auth/consent/marketing")
					.send({ agreed: true })
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});
});
