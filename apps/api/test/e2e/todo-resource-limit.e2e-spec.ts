/**
 * Todo 리소스 제한 E2E 테스트
 *
 * @description
 * 카테고리당 활성(미완료) Todo 300개 제한 테스트.
 * 제한은 구독 유형에 관계없이 동일하게 적용됩니다.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import { TODO_LIMITS } from "@aido/validators";
import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

const CATEGORY_LIMIT = TODO_LIMITS.MAX_PER_CATEGORY; // 300

describe("Todo Resource Limit (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	// ============================================
	// 카테고리당 활성 Todo 제한 테스트
	// ============================================

	describe("카테고리당 활성 Todo 제한", () => {
		let accessToken: string;
		let userId: string;
		let categoryId: number;

		beforeAll(async () => {
			const user = await ctx.helpers.createVerifiedUser(
				"todo-limit-category@example.com",
				"Test1234!",
			);
			accessToken = user.accessToken;
			userId = user.userId;
			categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);

			// DB에 활성 Todo를 CATEGORY_LIMIT개 직접 삽입 (API보다 빠름)
			const prisma = ctx.testDatabase.getPrisma();
			const todos = Array.from({ length: CATEGORY_LIMIT }, (_, i) => ({
				userId,
				title: `활성 할 일 ${i + 1}`,
				categoryId,
				startDate: new Date("2024-01-15"),
				completed: false,
			}));
			await prisma.todo.createMany({ data: todos });
		});

		it(`활성 Todo ${CATEGORY_LIMIT}개 도달 후 생성 시 403 에러`, async () => {
			const response = await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "초과 할 일",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(403);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("TODO_0811");
		});

		it("GET /todos/resource-limit?categoryId - 현재 사용량과 한도 조회", async () => {
			const response = await request(ctx.app.getHttpServer())
				.get(`/todos/resource-limit?categoryId=${categoryId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.data.activeCount).toBe(CATEGORY_LIMIT);
			expect(response.body.data.maxPerCategory).toBe(CATEGORY_LIMIT);
		});

		it("GET /todos/resource-limit (categoryId 없음) - maxPerCategory만 반환", async () => {
			const response = await request(ctx.app.getHttpServer())
				.get("/todos/resource-limit")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.data.maxPerCategory).toBe(CATEGORY_LIMIT);
			expect(response.body.data.activeCount).toBeUndefined();
		});
	});

	// ============================================
	// Todo 완료 후 생성 가능 테스트
	// ============================================

	describe("활성 Todo 완료 후 생성 가능", () => {
		let accessToken: string;
		let userId: string;
		let categoryId: number;
		let firstTodoId: number;

		beforeAll(async () => {
			const user = await ctx.helpers.createVerifiedUser(
				"todo-limit-complete@example.com",
				"Test1234!",
			);
			accessToken = user.accessToken;
			userId = user.userId;
			categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);

			// DB에 활성 Todo를 CATEGORY_LIMIT개 삽입
			const prisma = ctx.testDatabase.getPrisma();
			const todos = Array.from({ length: CATEGORY_LIMIT }, (_, i) => ({
				userId,
				title: `활성 할 일 ${i + 1}`,
				categoryId,
				startDate: new Date("2024-01-15"),
				completed: false,
			}));
			await prisma.todo.createMany({ data: todos });

			// 첫 번째 Todo ID 조회
			const firstTodo = await prisma.todo.findFirst({
				where: { userId },
				orderBy: { id: "asc" },
			});
			expect(firstTodo).toBeDefined();
			firstTodoId = firstTodo?.id as number;
		});

		it("활성 Todo 1개 완료 후 새 Todo 생성 성공", async () => {
			// 1개 완료
			await request(ctx.app.getHttpServer())
				.patch(`/todos/${firstTodoId}/complete`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ completed: true })
				.expect(200);

			// 새 Todo 생성 → 성공
			const response = await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "완료 후 새 할 일",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(201);

			expect(response.body.data.todo.title).toBe("완료 후 새 할 일");
		});
	});

	// ============================================
	// 다른 카테고리에는 생성 가능 테스트
	// ============================================

	describe("다른 카테고리에는 생성 가능", () => {
		let accessToken: string;
		let userId: string;
		let fullCategoryId: number;
		let emptyCategoryId: number;

		beforeAll(async () => {
			const user = await ctx.helpers.createVerifiedUser(
				"todo-limit-other-cat@example.com",
				"Test1234!",
			);
			accessToken = user.accessToken;
			userId = user.userId;
			fullCategoryId = await ctx.helpers.getDefaultCategoryId(accessToken);

			// 새 카테고리 생성
			const catResponse = await request(ctx.app.getHttpServer())
				.post("/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "빈 카테고리", color: "#00FF00" })
				.expect(201);
			emptyCategoryId = catResponse.body.data.category.id;

			// 첫 번째 카테고리에 CATEGORY_LIMIT개 삽입
			const prisma = ctx.testDatabase.getPrisma();
			const todos = Array.from({ length: CATEGORY_LIMIT }, (_, i) => ({
				userId,
				title: `카테고리1 할 일 ${i + 1}`,
				categoryId: fullCategoryId,
				startDate: new Date("2024-01-15"),
				completed: false,
			}));
			await prisma.todo.createMany({ data: todos });
		});

		it("한 카테고리가 꽉 차도 다른 카테고리에는 생성 가능", async () => {
			// 꽉 찬 카테고리에 생성 → 실패
			await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "초과 할 일",
					categoryId: fullCategoryId,
					startDate: "2024-01-15",
				})
				.expect(403);

			// 빈 카테고리에 생성 → 성공
			const response = await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "다른 카테고리 할 일",
					categoryId: emptyCategoryId,
					startDate: "2024-01-15",
				})
				.expect(201);

			expect(response.body.data.todo.title).toBe("다른 카테고리 할 일");
		});
	});

	// ============================================
	// 프리미엄/무료 동일 제한 테스트
	// ============================================

	describe("프리미엄/무료 동일 카테고리당 제한", () => {
		let accessToken: string;
		let userId: string;
		let categoryId: number;

		beforeAll(async () => {
			const user = await ctx.helpers.createVerifiedUser(
				"todo-limit-premium@example.com",
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

			categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);

			// DB에 활성 Todo를 CATEGORY_LIMIT개 삽입
			const todos = Array.from({ length: CATEGORY_LIMIT }, (_, i) => ({
				userId,
				title: `프리미엄 할 일 ${i + 1}`,
				categoryId,
				startDate: new Date("2024-01-15"),
				completed: false,
			}));
			await prisma.todo.createMany({ data: todos });
		});

		it("프리미엄 유저도 카테고리당 한도에 도달하면 생성 불가", async () => {
			const response = await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "프리미엄 초과 할 일",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(403);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("TODO_0811");
		});

		it("GET /todos/resource-limit?categoryId - maxPerCategory는 동일", async () => {
			const response = await request(ctx.app.getHttpServer())
				.get(`/todos/resource-limit?categoryId=${categoryId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.data.maxPerCategory).toBe(CATEGORY_LIMIT);
			expect(response.body.data.activeCount).toBe(CATEGORY_LIMIT);
		});
	});
});
