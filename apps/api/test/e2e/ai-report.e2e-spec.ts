/**
 * AI 리포트 모듈 E2E 테스트
 *
 * @description
 * AI 리포트 API의 전체 HTTP 요청/응답 플로우 테스트.
 * FakeAiProvider를 사용하여 실제 Gemini API 호출을 모킹합니다.
 *
 * ### 테스트 범위
 * - GET /ai/reports/status: 리포트 상태 조회
 * - GET /ai/reports: 리포트 목록 조회
 * - GET /ai/reports/:id: 리포트 상세 조회
 * - 인증 에러 (401)
 */

import request from "supertest";
import { CacheService } from "@/common/cache/cache.service";
import { DatabaseService } from "@/database/database.service";
import { AI_PROVIDER } from "@/modules/ai/providers/ai.provider";
import { FakeAiProvider } from "../mocks/fake-ai.provider";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("AI Report (e2e)", () => {
	let ctx: E2eTestContext;
	let fakeAiProvider: FakeAiProvider;
	let accessToken: string;

	const testUser = {
		email: "ai-report-test@example.com",
		password: "Test1234!",
	};

	beforeAll(async () => {
		fakeAiProvider = new FakeAiProvider();

		ctx = await createE2eApp({
			customizeBuilder: (builder) =>
				builder.overrideProvider(AI_PROVIDER).useValue(fakeAiProvider),
		});

		// 테스트 사용자 생성 및 인증
		const user = await ctx.helpers.createVerifiedUser(
			testUser.email,
			testUser.password,
		);
		accessToken = user.accessToken;

		// AI Report는 프리미엄 기능이므로 구독 상태를 ACTIVE로 변경
		const prisma = ctx.module.get(DatabaseService);
		await prisma.user.update({
			where: { id: user.userId },
			data: { subscriptionStatus: "ACTIVE" },
		});
		// 캐시 무효화 (EntitlementService가 구독 상태를 캐시함)
		const cacheService = ctx.module.get(CacheService);
		await cacheService.invalidateSubscription(user.userId);
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	beforeEach(() => {
		fakeAiProvider.clear();
	});

	// ============================================
	// GET /ai/reports/status
	// ============================================

	describe("GET /ai/reports/status", () => {
		it("200: 다음 리포트 예정일을 포함한 상태를 반환해야 한다", async () => {
			// Given - 인증된 사용자

			// When - 리포트 상태 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/ai/reports/status")
				.set("Authorization", `Bearer ${accessToken}`)
				.set("X-Timezone", "Asia/Seoul");

			// Then - 200 응답과 상태 데이터 반환
			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			const status = response.body.data.status;
			expect(status.nextWeeklyAt).toBeDefined();
			expect(status.nextMonthlyAt).toBeDefined();
			expect(status.daysUntilWeekly).toBeGreaterThanOrEqual(0);
			expect(status.daysUntilMonthly).toBeGreaterThanOrEqual(0);
			expect(status.latestWeekly).toBeNull();
			expect(status.latestMonthly).toBeNull();
		});

		it("401: 인증 토큰 없이 요청 시 에러를 반환해야 한다", async () => {
			// Given - 인증 토큰 없음

			// When - 토큰 없이 상태 조회
			const response = await request(ctx.app.getHttpServer()).get(
				"/ai/reports/status",
			);

			// Then - 401 Unauthorized 반환
			expect(response.status).toBe(401);
		});
	});

	// ============================================
	// GET /ai/reports
	// ============================================

	describe("GET /ai/reports", () => {
		it("200: 빈 리포트 목록을 반환해야 한다 (초기 상태)", async () => {
			// Given - 리포트가 없는 초기 상태

			// When - 리포트 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/ai/reports")
				.set("Authorization", `Bearer ${accessToken}`);

			// Then - 200 응답과 빈 배열 반환
			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.reports).toEqual([]);
		});

		it("200: type 필터를 적용하여 조회할 수 있어야 한다", async () => {
			// Given - 인증된 사용자

			// When - WEEKLY 타입으로 필터링
			const response = await request(ctx.app.getHttpServer())
				.get("/ai/reports?type=WEEKLY&limit=5")
				.set("Authorization", `Bearer ${accessToken}`);

			// Then - 200 응답 (빈 배열)
			expect(response.status).toBe(200);
			expect(response.body.data.reports).toEqual([]);
		});

		it("401: 인증 없이 요청 시 에러를 반환해야 한다", async () => {
			// Given - 인증 토큰 없음

			// When - 토큰 없이 목록 조회
			const response = await request(ctx.app.getHttpServer()).get(
				"/ai/reports",
			);

			// Then - 401 Unauthorized 반환
			expect(response.status).toBe(401);
		});
	});

	// ============================================
	// GET /ai/reports/:id
	// ============================================

	describe("GET /ai/reports/:id", () => {
		it("404: 존재하지 않는 리포트 조회 시 에러를 반환해야 한다", async () => {
			// Given - 존재하지 않는 리포트 ID

			// When - 없는 리포트 상세 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/ai/reports/99999")
				.set("Authorization", `Bearer ${accessToken}`);

			// Then - 404 Not Found 반환
			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("AI_1304");
		});

		it("401: 인증 없이 요청 시 에러를 반환해야 한다", async () => {
			// Given - 인증 토큰 없음

			// When - 토큰 없이 상세 조회
			const response = await request(ctx.app.getHttpServer()).get(
				"/ai/reports/1",
			);

			// Then - 401 Unauthorized 반환
			expect(response.status).toBe(401);
		});

		it("400: 유효하지 않은 ID 형식 시 에러를 반환해야 한다", async () => {
			// Given - 인증된 사용자

			// When - 문자열 ID로 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/ai/reports/invalid")
				.set("Authorization", `Bearer ${accessToken}`);

			// Then - 400 Bad Request 반환
			expect(response.status).toBe(400);
		});
	});
});
