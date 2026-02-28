/**
 * Todo 리소스 제한 E2E 테스트
 *
 * @description
 * Free 유저의 활성(미완료) Todo 30개 제한 테스트.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import { TODO_LIMITS } from "@aido/validators";
import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

const FREE_LIMIT = TODO_LIMITS.FREE_MAX_ACTIVE; // 30

describe("Todo Resource Limit (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	// ============================================
	// Free 유저 제한 테스트
	// ============================================

	describe("Free 유저 활성 Todo 제한", () => {
		let accessToken: string;
		let userId: string;
		let categoryId: number;

		beforeAll(async () => {
			const user = await ctx.helpers.createVerifiedUser(
				"todo-limit-free@example.com",
				"Test1234!",
			);
			accessToken = user.accessToken;
			userId = user.userId;
			categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);

			// DB에 활성 Todo를 FREE_LIMIT개 직접 삽입 (API보다 빠름)
			const prisma = ctx.testDatabase.getPrisma();
			const todos = Array.from({ length: FREE_LIMIT }, (_, i) => ({
				userId,
				title: `활성 할 일 ${i + 1}`,
				categoryId,
				startDate: new Date("2024-01-15"),
				completed: false,
			}));
			await prisma.todo.createMany({ data: todos });
		});

		it(`활성 Todo ${FREE_LIMIT}개 도달 후 생성 시 403 에러`, async () => {
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

		it("GET /todos/resource-limit - 현재 사용량과 한도 조회", async () => {
			const response = await request(ctx.app.getHttpServer())
				.get("/todos/resource-limit")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.data.activeCount).toBe(FREE_LIMIT);
			expect(response.body.data.maxCount).toBe(FREE_LIMIT);
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

			// DB에 활성 Todo를 FREE_LIMIT개 삽입
			const prisma = ctx.testDatabase.getPrisma();
			const todos = Array.from({ length: FREE_LIMIT }, (_, i) => ({
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
	// Premium 유저 무제한 테스트
	// ============================================

	describe("Premium 유저 무제한", () => {
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

			// DB에 활성 Todo를 FREE_LIMIT + 5개 삽입
			const todos = Array.from({ length: FREE_LIMIT + 5 }, (_, i) => ({
				userId,
				title: `프리미엄 할 일 ${i + 1}`,
				categoryId,
				startDate: new Date("2024-01-15"),
				completed: false,
			}));
			await prisma.todo.createMany({ data: todos });
		});

		it("Free 한도 초과해도 생성 성공", async () => {
			const response = await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "프리미엄 추가 할 일",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(201);

			expect(response.body.data.todo.title).toBe("프리미엄 추가 할 일");
		});

		it("GET /todos/resource-limit - maxCount가 null (무제한)", async () => {
			const response = await request(ctx.app.getHttpServer())
				.get("/todos/resource-limit")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body.data.maxCount).toBeNull();
			expect(response.body.data.activeCount).toBeGreaterThan(FREE_LIMIT);
		});
	});
});
