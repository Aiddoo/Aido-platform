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

describe("TodoCategory Resource Limit (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	// ============================================
	// Free 유저 카테고리 제한
	// ============================================

	describe("Free 유저 카테고리 제한", () => {
		let accessToken: string;

		beforeAll(async () => {
			const user = await ctx.helpers.createVerifiedUser(
				"cat-limit-free@example.com",
				"Test1234!",
			);
			accessToken = user.accessToken;
			// 기본 카테고리 2개 자동 생성됨
		});

		it("3번째 카테고리 생성 성공 (한도 도달)", async () => {
			const response = await request(ctx.app.getHttpServer())
				.post("/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "추가 카테고리", color: "#00FF00" })
				.expect(201);

			expect(response.body.data.category.name).toBe("추가 카테고리");
		});

		it("4번째 카테고리 생성 시 403 에러", async () => {
			const response = await request(ctx.app.getHttpServer())
				.post("/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "초과 카테고리", color: "#0000FF" })
				.expect(403);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("TODO_CATEGORY_0857");
		});

		it("GET /todo-categories/resource-limit - 현재 사용량과 한도 조회", async () => {
			const response = await request(ctx.app.getHttpServer())
				.get("/todo-categories/resource-limit")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.data.categoryCount).toBe(FREE_LIMIT);
			expect(response.body.data.maxCount).toBe(FREE_LIMIT);
		});
	});

	// ============================================
	// Premium 유저 무제한
	// ============================================

	describe("Premium 유저 무제한", () => {
		let accessToken: string;
		let userId: string;

		beforeAll(async () => {
			const user = await ctx.helpers.createVerifiedUser(
				"cat-limit-premium@example.com",
				"Test1234!",
			);
			accessToken = user.accessToken;
			userId = user.userId;

			// 구독 상태를 ACTIVE로 변경
			const prisma = ctx.testDatabase.getPrisma();
			await prisma.user.update({
				where: { id: userId },
				data: { subscriptionStatus: "ACTIVE" },
			});
		});

		it("Free 한도(3개)를 초과하여 카테고리 생성 성공", async () => {
			// 기본 2개 + 추가 3개 = 5개 (한도 초과)
			for (let i = 1; i <= 3; i++) {
				const response = await request(ctx.app.getHttpServer())
					.post("/todo-categories")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ name: `프리미엄 카테고리 ${i}`, color: "#FF0000" })
					.expect(201);

				expect(response.body.data.category.name).toBe(`프리미엄 카테고리 ${i}`);
			}
		});

		it("GET /todo-categories/resource-limit - maxCount가 30 (ACTIVE 구독)", async () => {
			const response = await request(ctx.app.getHttpServer())
				.get("/todo-categories/resource-limit")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.data.maxCount).toBe(
				SUBSCRIPTION_TODO_CATEGORY_LIMITS.ACTIVE,
			);
			expect(response.body.data.categoryCount).toBe(5); // 기본 2 + 추가 3
		});
	});
});
