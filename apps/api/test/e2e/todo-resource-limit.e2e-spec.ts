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

describe("할 일 리소스 제한 E2E", () => {
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

	const password = "Test1234!";

	describe("카테고리당 활성 Todo 제한", () => {
		it(`활성 Todo ${CATEGORY_LIMIT}개 도달 후 생성 시 403 에러, 리소스 제한 조회, categoryId 없이 조회`, async () => {
			// Given - 카테고리에 활성 Todo가 CATEGORY_LIMIT개 존재
			const user = await ctx.helpers.createVerifiedUser("todo-limit-cat@test.com", password);
			const accessToken = user.accessToken;
			const userId = user.userId;
			const categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);

			const prisma = ctx.testDatabase.getPrisma();
			const todos = Array.from({ length: CATEGORY_LIMIT }, (_, i) => ({
				userId,
				title: `활성 할 일 ${i + 1}`,
				categoryId,
				startDate: new Date("2024-01-15"),
				completed: false,
			}));
			await prisma.todo.createMany({ data: todos });

			// When - 추가 Todo 생성 시도
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "초과 할 일",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(403);

			// Then - 403 에러와 TODO_0811 코드 반환
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("TODO_0811");

			// When - categoryId로 리소스 제한 조회
			const limitResponse = await request(ctx.app.getHttpServer())
				.get(`/v1/todos/resource-limit?categoryId=${categoryId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - activeCount와 maxPerCategory가 CATEGORY_LIMIT과 일치
			expect(limitResponse.body.data.activeCount).toBe(CATEGORY_LIMIT);
			expect(limitResponse.body.data.maxPerCategory).toBe(CATEGORY_LIMIT);

			// When - categoryId 없이 리소스 제한 조회
			const noIdResponse = await request(ctx.app.getHttpServer())
				.get("/v1/todos/resource-limit")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - maxPerCategory만 반환되고 activeCount는 없음
			expect(noIdResponse.body.data.maxPerCategory).toBe(CATEGORY_LIMIT);
			expect(noIdResponse.body.data.activeCount).toBeUndefined();
		});
	});

	describe("활성 Todo 완료 후 생성 가능", () => {
		it("활성 Todo 1개 완료 후 새 Todo 생성 성공", async () => {
			// Given - 카테고리에 활성 Todo가 CATEGORY_LIMIT개 존재
			const user = await ctx.helpers.createVerifiedUser("todo-limit-complete@test.com", password);
			const accessToken = user.accessToken;
			const userId = user.userId;
			const categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);

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
			const firstTodoId = firstTodo?.id as number;

			// When - 1개 완료 후 새 Todo 생성
			await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${firstTodoId}/complete`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ completed: true })
				.expect(200);

			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "완료 후 새 할 일",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(201);

			// Then - 새 Todo 생성 성공
			expect(response.body.data.todo.title).toBe("완료 후 새 할 일");
		});
	});

	describe("다른 카테고리에는 생성 가능", () => {
		it("한 카테고리가 꽉 차도 다른 카테고리에는 생성 가능", async () => {
			// Given - fullCategoryId에 CATEGORY_LIMIT개, emptyCategoryId에 0개
			const user = await ctx.helpers.createVerifiedUser("todo-limit-other-cat@test.com", password);
			const accessToken = user.accessToken;
			const userId = user.userId;
			const fullCategoryId = await ctx.helpers.getDefaultCategoryId(accessToken);

			// 새 카테고리 생성
			const catResponse = await request(ctx.app.getHttpServer())
				.post("/v1/todo-categories")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "빈 카테고리", color: "#00FF00" })
				.expect(201);
			const emptyCategoryId = catResponse.body.data.category.id;

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

			// When - 꽉 찬 카테고리에 생성 시도
			await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "초과 할 일",
					categoryId: fullCategoryId,
					startDate: "2024-01-15",
				})
				.expect(403);

			// When - 빈 카테고리에 생성 시도
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "다른 카테고리 할 일",
					categoryId: emptyCategoryId,
					startDate: "2024-01-15",
				})
				.expect(201);

			// Then - 빈 카테고리에는 생성 성공
			expect(response.body.data.todo.title).toBe("다른 카테고리 할 일");
		});
	});

	describe("프리미엄/무료 동일 카테고리당 제한", () => {
		it("프리미엄 유저도 카테고리당 한도에 도달하면 생성 불가, 리소스 제한 조회 확인", async () => {
			// Given - 카테고리에 활성 Todo가 CATEGORY_LIMIT개 존재하는 Premium 유저
			const user = await ctx.helpers.createVerifiedUser("todo-limit-premium@test.com", password);
			const accessToken = user.accessToken;
			const userId = user.userId;

			// 구독 상태를 ACTIVE로 변경
			const prisma = ctx.testDatabase.getPrisma();
			await prisma.user.update({
				where: { id: userId },
				data: { subscriptionStatus: "ACTIVE" },
			});

			const categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);

			// DB에 활성 Todo를 CATEGORY_LIMIT개 삽입
			const todos = Array.from({ length: CATEGORY_LIMIT }, (_, i) => ({
				userId,
				title: `프리미엄 할 일 ${i + 1}`,
				categoryId,
				startDate: new Date("2024-01-15"),
				completed: false,
			}));
			await prisma.todo.createMany({ data: todos });

			// When - 추가 Todo 생성 시도
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/todos")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					title: "프리미엄 초과 할 일",
					categoryId,
					startDate: "2024-01-15",
				})
				.expect(403);

			// Then - 403 에러와 TODO_0811 코드 반환
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("TODO_0811");

			// When - categoryId로 리소스 제한 조회
			const limitResponse = await request(ctx.app.getHttpServer())
				.get(`/v1/todos/resource-limit?categoryId=${categoryId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - maxPerCategory와 activeCount가 CATEGORY_LIMIT과 일치
			expect(limitResponse.body.data.maxPerCategory).toBe(CATEGORY_LIMIT);
			expect(limitResponse.body.data.activeCount).toBe(CATEGORY_LIMIT);
		});
	});
});
