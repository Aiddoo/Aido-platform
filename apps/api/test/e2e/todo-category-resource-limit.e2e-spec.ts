/**
 * TodoCategory 리소스 제한 E2E 테스트
 *
 * @description
 * Free 유저의 카테고리 3개 제한 테스트.
 * 회원가입 시 기본 카테고리 2개가 자동 생성되므로, 1개만 추가하면 한도에 도달합니다.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import {
	SUBSCRIPTION_TODO_CATEGORY_LIMITS,
	TODO_CATEGORY_LIMITS,
} from "@aido/validators";
import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

const FREE_LIMIT = TODO_CATEGORY_LIMITS.FREE_MAX_COUNT; // 3

describe("할 일 카테고리 리소스 제한 E2E", () => {
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

	const password = "Test1234!";

	describe("Free 유저 카테고리 제한", () => {
		it("3번째 카테고리 생성 성공 후 4번째 생성 시 403 에러, 리소스 제한 조회 확인", async () => {
			// Given - 기본 카테고리 2개가 자동 생성된 Free 유저
			const user = await ctx.helpers.createVerifiedUser(
				"cat-limit-free@test.com",
				password,
			);
			const accessToken = user.accessToken;

			// When - 3번째 카테고리 생성
			const createResponse = await request(ctx.app.getHttpServer())
				.post("/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "추가 카테고리", color: "#00FF00" })
				.expect(201);

			// Then - 카테고리 생성 성공
			expect(createResponse.body.data.category.name).toBe("추가 카테고리");

			// When - 4번째 카테고리 생성 시도
			const overResponse = await request(ctx.app.getHttpServer())
				.post("/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "초과 카테고리", color: "#0000FF" })
				.expect(403);

			// Then - 403 에러와 TODO_CATEGORY_0857 코드 반환
			expect(overResponse.body.success).toBe(false);
			expect(overResponse.body.error.code).toBe("TODO_CATEGORY_0857");

			// When - 리소스 제한 조회
			const limitResponse = await request(ctx.app.getHttpServer())
				.get("/todo-categories/resource-limit")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 현재 카테고리 수와 한도가 FREE_LIMIT과 일치
			expect(limitResponse.body.data.categoryCount).toBe(FREE_LIMIT);
			expect(limitResponse.body.data.maxCount).toBe(FREE_LIMIT);
		});
	});

	describe("Premium 유저 무제한", () => {
		it("Free 한도(3개)를 초과하여 카테고리 생성 성공하고 maxCount가 ACTIVE 구독 한도", async () => {
			// Given - 기본 카테고리 2개가 있는 Premium 유저
			const user = await ctx.helpers.createVerifiedUser(
				"cat-limit-premium@test.com",
				password,
			);
			const accessToken = user.accessToken;

			// 구독 상태를 ACTIVE로 변경
			const prisma = ctx.testDatabase.getPrisma();
			await prisma.user.update({
				where: { id: user.userId },
				data: { subscriptionStatus: "ACTIVE" },
			});

			// When - 3개 추가 생성 (기본 2 + 추가 3 = 5개, Free 한도 초과)
			for (let i = 1; i <= 3; i++) {
				const response = await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ name: `프리미엄 카테고리 ${i}`, color: "#FF0000" })
					.expect(201);

				// Then - 각 카테고리 생성 성공
				expect(response.body.data.category.name).toBe(`프리미엄 카테고리 ${i}`);
			}

			// When - 리소스 제한 조회
			const limitResponse = await request(ctx.app.getHttpServer())
				.get("/todo-categories/resource-limit")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - maxCount가 ACTIVE 구독 한도(30)이고 카테고리 수는 5
			expect(limitResponse.body.data.maxCount).toBe(
				SUBSCRIPTION_TODO_CATEGORY_LIMITS.ACTIVE,
			);
			expect(limitResponse.body.data.categoryCount).toBe(5); // 기본 2 + 추가 3
		});
	});
});
