/**
 * AI 반복 제안 모듈 E2E 테스트
 *
 * @description
 * AI 반복 제안 API의 전체 HTTP 요청/응답 플로우 테스트.
 * FakeAiProvider를 사용하여 실제 Gemini API 호출을 모킹합니다.
 *
 * ### 테스트 범위
 * - GET /ai/suggestions: 대기 중인 제안 목록 조회
 * - PATCH /ai/suggestions/:id: 제안 수락/거절
 * - 인증 에러 (401)
 */

import request from "supertest";
import { AI_PROVIDER } from "@/ai/providers/ai.provider";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { FakeAiProvider } from "../mocks/fake-ai.provider";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("AI 제안 E2E", () => {
	let ctx: E2eTestContext;
	let fakeAiProvider: FakeAiProvider;

	beforeAll(async () => {
		fakeAiProvider = new FakeAiProvider();

		ctx = await createE2eApp({
			customizeBuilder: (builder) =>
				builder.overrideProvider(AI_PROVIDER).useValue(fakeAiProvider),
		});
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	beforeEach(async () => {
		await ctx.testDatabase.cleanup();
		ctx.fakeEmailService.clear();
		fakeAiProvider.clear();
	});

	/** 프리미엄 사용자를 생성하고 토큰을 반환하는 헬퍼 */
	async function createPremiumUser(email: string, password: string) {
		const user = await ctx.helpers.createVerifiedUser(email, password);
		const prisma = ctx.module.get(DatabaseService);
		await prisma.user.update({
			where: { id: user.userId },
			data: { subscriptionStatus: "ACTIVE" },
		});
		const cacheService = ctx.module.get(CacheService);
		await cacheService.invalidateSubscription(user.userId);
		return user;
	}

	describe("GET /ai/suggestions", () => {
		it("200: 빈 제안 목록을 반환해야 한다 (초기 상태)", async () => {
			// Given - 프리미엄 사용자, 제안이 없는 초기 상태
			const user = await createPremiumUser(
				"ai-suggestion-list@example.com",
				"Test1234!",
			);

			// When - 제안 목록 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/ai/suggestions")
				.set("Authorization", `Bearer ${user.accessToken}`);

			// Then - 200 응답과 빈 배열 반환
			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.suggestions).toEqual([]);
		});

		it("401: 인증 토큰 없이 요청 시 에러를 반환해야 한다", async () => {
			// Given - 인증 토큰 없음

			// When - 토큰 없이 목록 조회
			const response = await request(ctx.app.getHttpServer()).get(
				"/ai/suggestions",
			);

			// Then - 401 Unauthorized 반환
			expect(response.status).toBe(401);
		});
	});

	describe("PATCH /ai/suggestions/:id", () => {
		it("404: 존재하지 않는 제안에 대해 에러를 반환해야 한다", async () => {
			// Given - 프리미엄 사용자, 존재하지 않는 제안 ID
			const user = await createPremiumUser(
				"ai-suggestion-404@example.com",
				"Test1234!",
			);

			// When - 없는 제안에 대해 액션 수행
			const response = await request(ctx.app.getHttpServer())
				.patch("/ai/suggestions/99999")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.set("X-Timezone", "Asia/Seoul")
				.send({ action: "dismiss" });

			// Then - 404 Not Found 반환
			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("AI_1305");
		});

		it("401: 인증 없이 요청 시 에러를 반환해야 한다", async () => {
			// Given - 인증 토큰 없음

			// When - 토큰 없이 액션 수행
			const response = await request(ctx.app.getHttpServer())
				.patch("/ai/suggestions/1")
				.send({ action: "dismiss" });

			// Then - 401 Unauthorized 반환
			expect(response.status).toBe(401);
		});
	});
});
