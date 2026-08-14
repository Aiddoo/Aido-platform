/**
 * 오늘의 할 일 요약 E2E 테스트 (홈 위젯용 GET /todos/summary)
 *
 * @description
 * 진행률 + 스트릭 + 상위 할 일을 한 번에 반환하는 위젯 스냅샷 엔드포인트.
 * X-Timezone 헤더 기준 "오늘" 판정과 정적 세그먼트 라우팅(:id 미충돌)을 검증합니다.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import request from "supertest";

import { toDateString } from "@/shared/domain/date/utils/format";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("오늘의 할 일 요약 E2E", () => {
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
	const timezone = "Asia/Seoul";
	const activeDateRange = () => {
		const today = todayInTimezone(timezone);
		return {
			today,
			startDate: new Date(today.getTime() - 24 * 60 * 60 * 1000),
			endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
		};
	};

	describe("GET /todos/summary", () => {
		it("오늘 진행률·스트릭·상위 할 일을 요약으로 반환한다", async () => {
			// Given - 오늘 할 일 3개 중 1개 완료
			const user = await ctx.helpers.createVerifiedUser("todo-summary@test.com", password);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);

			const { startDate, endDate } = activeDateRange();
			const prisma = ctx.testDatabase.getPrisma();
			await prisma.todo.createMany({
				data: [
					{
						userId: user.userId,
						title: "완료한 할 일",
						categoryId,
						startDate,
						endDate,
						sortOrder: 0,
						completed: true,
						completedAt: new Date(),
					},
					{
						userId: user.userId,
						title: "남은 할 일 1",
						categoryId,
						startDate,
						endDate,
						sortOrder: 1,
						completed: false,
					},
					{
						userId: user.userId,
						title: "남은 할 일 2",
						categoryId,
						startDate,
						endDate,
						sortOrder: 2,
						completed: false,
					},
				],
			});

			// When
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos/summary")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.set("X-Timezone", timezone);

			// Then
			expect(response.status).toBe(200);
			expect(response.body.data).toEqual({
				date: toDateString(todayInTimezone(timezone)),
				totalTodos: 3,
				completedTodos: 1,
				completionRate: 33,
				isComplete: false,
				currentStreak: expect.any(Number),
				// 미완료 우선 정렬 — 남은 일이 위, 완료한 일이 아래
				topTodos: [
					{
						id: expect.any(Number),
						title: "남은 할 일 1",
						completed: false,
						categoryColor: expect.any(String),
					},
					{
						id: expect.any(Number),
						title: "남은 할 일 2",
						completed: false,
						categoryColor: expect.any(String),
					},
					{
						id: expect.any(Number),
						title: "완료한 할 일",
						completed: true,
						categoryColor: expect.any(String),
					},
				],
			});
		});

		it("할 일이 없는 날은 빈 요약(완료율 0)을 반환한다", async () => {
			// Given
			const user = await ctx.helpers.createVerifiedUser("todo-summary-empty@test.com", password);

			// When
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos/summary")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.set("X-Timezone", timezone);

			// Then
			expect(response.status).toBe(200);
			expect(response.body.data.totalTodos).toBe(0);
			expect(response.body.data.completionRate).toBe(0);
			expect(response.body.data.isComplete).toBe(false);
			expect(response.body.data.topTodos).toEqual([]);
		});

		it("상위 할 일은 최대 10개, 미완료가 항상 완료보다 먼저 온다", async () => {
			// Given - 오늘 할 일 12개, 정렬 앞쪽(sortOrder 0~5) 6개는 완료 상태
			const user = await ctx.helpers.createVerifiedUser("todo-summary-limit@test.com", password);
			const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);
			const { startDate, endDate } = activeDateRange();
			const prisma = ctx.testDatabase.getPrisma();
			await prisma.todo.createMany({
				data: Array.from({ length: 12 }, (_, i) => ({
					userId: user.userId,
					title: `할 일 ${i + 1}`,
					categoryId,
					startDate,
					endDate,
					sortOrder: i,
					completed: i < 6,
					...(i < 6 && { completedAt: new Date() }),
				})),
			});

			// When
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos/summary")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.set("X-Timezone", timezone);

			// Then - 총계는 전체(12), 목록은 10개로 절단
			expect(response.status).toBe(200);
			expect(response.body.data.totalTodos).toBe(12);
			expect(response.body.data.topTodos).toHaveLength(10);

			// 미완료 6개가 전부 앞에, 완료는 그 뒤에 온다 (sortOrder가 앞서도 완료면 뒤로)
			const completedFlags = response.body.data.topTodos.map(
				(todo: { completed: boolean }) => todo.completed,
			);
			expect(completedFlags).toEqual([
				false,
				false,
				false,
				false,
				false,
				false,
				true,
				true,
				true,
				true,
			]);
		});

		it("인증 없이 호출하면 401을 반환한다", async () => {
			// When
			const response = await request(ctx.app.getHttpServer()).get("/v1/todos/summary");

			// Then
			expect(response.status).toBe(401);
		});

		it("summary 정적 세그먼트가 :id 라우트로 매칭되지 않는다", async () => {
			// Given
			const user = await ctx.helpers.createVerifiedUser("todo-summary-route@test.com", password);

			// When - :id 라우트였다면 "summary"가 숫자 파싱에 실패해 400이 됐을 것
			const response = await request(ctx.app.getHttpServer())
				.get("/v1/todos/summary")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.set("X-Timezone", timezone);

			// Then
			expect(response.status).toBe(200);
		});
	});
});
