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
import { AI_PROVIDER } from "@/ai";
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
			additionalResetters: [() => fakeAiProvider.clear()],
		});
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	beforeEach(async () => {
		await ctx.reset();
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

	/** PENDING 상태의 AI 제안 행을 직접 시딩하고 ID를 반환하는 헬퍼 */
	async function seedPendingSuggestion(
		userId: string,
		overrides?: {
			status?: "PENDING" | "ACCEPTED" | "DISMISSED";
			daysOfWeek?: string[];
			scheduledTime?: string | null;
		},
	): Promise<number> {
		const prisma = ctx.testDatabase.getPrisma();
		const suggestion = await prisma.recurringSuggestion.create({
			data: {
				userId,
				title: "팀 미팅",
				daysOfWeek: overrides?.daysOfWeek ?? ["MON", "WED", "FRI"],
				scheduledTime:
					overrides?.scheduledTime === undefined
						? "10:00"
						: overrides.scheduledTime,
				confidence: 0.85,
				reason: "최근 2주간 반복 패턴 감지",
				matchedTodos: [],
				suggestedCategoryId: null,
				status: overrides?.status ?? "PENDING",
				expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
			},
		});
		return suggestion.id;
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
				.get("/v1/ai/suggestions")
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
				"/v1/ai/suggestions",
			);

			// Then - 401 Unauthorized 반환
			expect(response.status).toBe(401);
		});
	});

	describe("PATCH /ai/suggestions/:id", () => {
		it("200(accept): 제안 수락 시 ACCEPTED로 전이되고 반복 할 일이 생성된다", async () => {
			// Given - 프리미엄 사용자와 PENDING 제안
			const user = await createPremiumUser(
				"ai-suggestion-accept@example.com",
				"Test1234!",
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(
				user.accessToken,
			);
			const suggestionId = await seedPendingSuggestion(user.userId);

			// When - accept 액션 수행
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/ai/suggestions/${suggestionId}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.set("X-Timezone", "Asia/Seoul")
				.send({ action: "accept", categoryId });

			// Then - 200, ACCEPTED, 반복 할 일 생성 개수 반환
			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.suggestion.status).toBe("ACCEPTED");
			expect(response.body.data.createdTodosCount).toBeGreaterThan(0);
		});

		it("200(dismiss): 제안 거절 시 DISMISSED로 전이되고 할 일은 생성되지 않는다", async () => {
			// Given - 프리미엄 사용자와 PENDING 제안
			const user = await createPremiumUser(
				"ai-suggestion-dismiss@example.com",
				"Test1234!",
			);
			const suggestionId = await seedPendingSuggestion(user.userId);

			// When - dismiss 액션 수행
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/ai/suggestions/${suggestionId}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.set("X-Timezone", "Asia/Seoul")
				.send({ action: "dismiss" });

			// Then - 200, DISMISSED, createdTodosCount 없음
			expect(response.status).toBe(200);
			expect(response.body.data.suggestion.status).toBe("DISMISSED");
			expect(response.body.data.createdTodosCount).toBeUndefined();
		});

		it("409: 이미 처리된 제안 재처리 시 에러를 반환해야 한다 (AI_1306)", async () => {
			// Given - 이미 ACCEPTED 상태인 제안
			const user = await createPremiumUser(
				"ai-suggestion-409@example.com",
				"Test1234!",
			);
			const categoryId = await ctx.helpers.getDefaultCategoryId(
				user.accessToken,
			);
			const suggestionId = await seedPendingSuggestion(user.userId, {
				status: "ACCEPTED",
			});

			// When - 이미 처리된 제안에 다시 액션 수행
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/ai/suggestions/${suggestionId}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.set("X-Timezone", "Asia/Seoul")
				.send({ action: "accept", categoryId });

			// Then - 409 Conflict, AI_1306
			expect(response.status).toBe(409);
			expect(response.body.error.code).toBe("AI_1306");
		});

		it("400: 잘못된 action 값 요청 시 에러를 반환해야 한다", async () => {
			// Given - 프리미엄 사용자와 PENDING 제안
			const user = await createPremiumUser(
				"ai-suggestion-400@example.com",
				"Test1234!",
			);
			const suggestionId = await seedPendingSuggestion(user.userId);

			// When - 유효하지 않은 action 값으로 요청
			const response = await request(ctx.app.getHttpServer())
				.patch(`/v1/ai/suggestions/${suggestionId}`)
				.set("Authorization", `Bearer ${user.accessToken}`)
				.set("X-Timezone", "Asia/Seoul")
				.send({ action: "invalid" });

			// Then - 400 Bad Request
			expect(response.status).toBe(400);
			expect(response.body.success).toBe(false);
		});

		it("404: 존재하지 않는 제안에 대해 에러를 반환해야 한다", async () => {
			// Given - 프리미엄 사용자, 존재하지 않는 제안 ID
			const user = await createPremiumUser(
				"ai-suggestion-404@example.com",
				"Test1234!",
			);

			// When - 없는 제안에 대해 액션 수행
			const response = await request(ctx.app.getHttpServer())
				.patch("/v1/ai/suggestions/99999")
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
				.patch("/v1/ai/suggestions/1")
				.send({ action: "dismiss" });

			// Then - 401 Unauthorized 반환
			expect(response.status).toBe(401);
		});
	});
});
