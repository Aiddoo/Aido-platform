/**
 * DailyCompletion E2E 테스트
 *
 * @description
 * 일일 완료 현황 API 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("DailyCompletion (e2e)", () => {
	let ctx: E2eTestContext;

	/**
	 * 테스트용 Todo 생성 헬퍼
	 */
	async function createTodo(
		accessToken: string,
		data: { title: string; startDate: string; completed?: boolean },
	): Promise<{ id: number }> {
		const categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
		const response = await request(ctx.app.getHttpServer())
			.post("/todos")
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				title: data.title,
				startDate: data.startDate,
				categoryId,
			})
			.expect(201);

		const todoId = response.body.data.todo.id;

		// completed가 true인 경우 업데이트
		if (data.completed) {
			await request(ctx.app.getHttpServer())
				.patch(`/todos/${todoId}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ completed: true })
				.expect(200);
		}

		return { id: todoId };
	}

	/**
	 * 특정 날짜에 여러 Todo 생성 헬퍼
	 */
	async function createTodosForDate(
		accessToken: string,
		date: string,
		total: number,
		completed: number,
	): Promise<void> {
		for (let i = 0; i < total; i++) {
			await createTodo(accessToken, {
				title: `할 일 ${i + 1}`,
				startDate: date,
				completed: i < completed,
			});
		}
	}

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	describe("GET /daily-completions - 일일 완료 현황 조회", () => {
		describe("인증", () => {
			it("인증 없이 접근 시 401 반환", async () => {
				// Given - 인증되지 않은 상태

				// When - 인증 토큰 없이 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.query({ startDate: "2026-01-01", endDate: "2026-01-31" });

				// Then - 401 Unauthorized 반환
				expect(response.status).toBe(401);
			});

			it("잘못된 토큰으로 접근 시 401 반환", async () => {
				// Given - 유효하지 않은 토큰 준비

				// When - 잘못된 토큰으로 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", "Bearer invalid-token")
					.query({ startDate: "2026-01-01", endDate: "2026-01-31" });

				// Then - 401 Unauthorized 반환
				expect(response.status).toBe(401);
			});
		});

		describe("파라미터 검증", () => {
			let accessToken: string;

			beforeAll(async () => {
				const user = await ctx.helpers.createVerifiedUser(
					"param-test@example.com",
					"Test1234!",
				);
				accessToken = user.accessToken;
			});

			it("startDate 누락 시 400 반환", async () => {
				// Given - 인증된 사용자 준비

				// When - startDate 없이 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ endDate: "2026-01-31" });

				// Then - 400 Bad Request 반환
				expect(response.status).toBe(400);
				expect(response.body.success).toBe(false);
			});

			it("endDate 누락 시 400 반환", async () => {
				// Given - 인증된 사용자 준비

				// When - endDate 없이 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026-01-01" });

				// Then - 400 Bad Request 반환
				expect(response.status).toBe(400);
				expect(response.body.success).toBe(false);
			});

			it("잘못된 날짜 형식 시 400 반환", async () => {
				// Given - 인증된 사용자 준비

				// When - 잘못된 날짜 형식으로 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026/01/01", endDate: "2026-01-31" });

				// Then - 400 Bad Request 반환
				expect(response.status).toBe(400);
				expect(response.body.success).toBe(false);
			});

			it("endDate가 startDate보다 이전인 경우 400 반환", async () => {
				// Given - 인증된 사용자 준비

				// When - endDate가 startDate보다 이전인 값으로 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026-01-31", endDate: "2026-01-01" });

				// Then - 400 Bad Request 반환
				expect(response.status).toBe(400);
				expect(response.body.success).toBe(false);
			});
		});

		describe("정상 조회", () => {
			let accessToken: string;

			beforeAll(async () => {
				const user = await ctx.helpers.createVerifiedUser(
					"completions-test@example.com",
					"Test1234!",
				);
				accessToken = user.accessToken;

				// 테스트 데이터 생성
				// 2026-01-15: 3개 중 3개 완료 (100% - 물고기)
				await createTodosForDate(accessToken, "2026-01-15", 3, 3);

				// 2026-01-16: 4개 중 2개 완료 (50%)
				await createTodosForDate(accessToken, "2026-01-16", 4, 2);

				// 2026-01-17: 2개 중 0개 완료 (0%)
				await createTodosForDate(accessToken, "2026-01-17", 2, 0);

				// 2026-01-20: 1개 중 1개 완료 (100% - 물고기)
				await createTodosForDate(accessToken, "2026-01-20", 1, 1);
			});

			it("날짜 범위 내 완료 현황 조회 성공", async () => {
				// Given - 인증된 사용자와 4개 날짜에 Todo 데이터 준비 (100% 완료 2일)

				// When - 1월 전체 기간 완료 현황 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026-01-01", endDate: "2026-01-31" });

				// Then - 성공 응답과 완료 현황 데이터 반환
				expect(response.status).toBe(200);
				expect(response.body.success).toBe(true);
				expect(response.body.data).toHaveProperty("completions");
				expect(response.body.data).toHaveProperty("totalCompleteDays");
				expect(response.body.data).toHaveProperty("dateRange");

				const { completions, totalCompleteDays, dateRange } =
					response.body.data;

				// 날짜 범위 확인
				expect(dateRange.startDate).toBe("2026-01-01");
				expect(dateRange.endDate).toBe("2026-01-31");

				// 4개 날짜에 Todo가 있음
				expect(completions.length).toBe(4);

				// 100% 완료한 날 수 (물고기 개수)
				expect(totalCompleteDays).toBe(2);
			});

			it("완료 현황 상세 데이터 검증", async () => {
				// Given - 인증된 사용자와 3일간의 Todo 데이터 준비

				// When - 특정 3일 기간 완료 현황 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026-01-15", endDate: "2026-01-17" });

				// Then - 각 날짜별 상세 완료 현황 검증
				expect(response.status).toBe(200);
				const { completions } = response.body.data;

				// 날짜순 정렬 확인
				expect(completions[0].date).toBe("2026-01-15");
				expect(completions[1].date).toBe("2026-01-16");
				expect(completions[2].date).toBe("2026-01-17");

				// 2026-01-15: 3개 중 3개 완료
				const day15 = completions.find(
					(c: { date: string }) => c.date === "2026-01-15",
				);
				expect(day15.totalTodos).toBe(3);
				expect(day15.completedTodos).toBe(3);
				expect(day15.isComplete).toBe(true);
				expect(day15.completionRate).toBe(100);

				// 2026-01-16: 4개 중 2개 완료
				const day16 = completions.find(
					(c: { date: string }) => c.date === "2026-01-16",
				);
				expect(day16.totalTodos).toBe(4);
				expect(day16.completedTodos).toBe(2);
				expect(day16.isComplete).toBe(false);
				expect(day16.completionRate).toBe(50);

				// 2026-01-17: 2개 중 0개 완료
				const day17 = completions.find(
					(c: { date: string }) => c.date === "2026-01-17",
				);
				expect(day17.totalTodos).toBe(2);
				expect(day17.completedTodos).toBe(0);
				expect(day17.isComplete).toBe(false);
				expect(day17.completionRate).toBe(0);
			});

			it("특정 날짜만 조회", async () => {
				// Given - 인증된 사용자와 2026-01-20에 100% 완료된 Todo 준비

				// When - 단일 날짜 완료 현황 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026-01-20", endDate: "2026-01-20" });

				// Then - 해당 날짜의 완료 현황 반환
				expect(response.status).toBe(200);
				const { completions, totalCompleteDays } = response.body.data;

				expect(completions.length).toBe(1);
				expect(completions[0].date).toBe("2026-01-20");
				expect(completions[0].isComplete).toBe(true);
				expect(totalCompleteDays).toBe(1);
			});

			it("Todo가 없는 날짜 범위 조회 시 빈 배열 반환", async () => {
				// Given - 인증된 사용자 준비 (2월에는 Todo 없음)

				// When - Todo가 없는 2월 기간 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026-02-01", endDate: "2026-02-28" });

				// Then - 빈 completions 배열과 0개의 완료일 반환
				expect(response.status).toBe(200);
				expect(response.body.success).toBe(true);
				expect(response.body.data.completions).toEqual([]);
				expect(response.body.data.totalCompleteDays).toBe(0);
			});
		});

		describe("사용자 격리", () => {
			let user1Token: string;
			let user2Token: string;

			beforeAll(async () => {
				// 첫 번째 사용자 생성 및 Todo 추가
				const user1 = await ctx.helpers.createVerifiedUser(
					"isolation-user1@example.com",
					"Test1234!",
				);
				user1Token = user1.accessToken;
				await createTodosForDate(user1Token, "2026-03-01", 3, 3);

				// 두 번째 사용자 생성 및 Todo 추가
				const user2 = await ctx.helpers.createVerifiedUser(
					"isolation-user2@example.com",
					"Test1234!",
				);
				user2Token = user2.accessToken;
				await createTodosForDate(user2Token, "2026-03-01", 2, 1);
			});

			it("사용자 1은 자신의 데이터만 조회", async () => {
				// Given - 사용자 1 (3개 Todo, 100% 완료)과 사용자 2 (2개 Todo, 50% 완료) 준비

				// When - 사용자 1이 완료 현황 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${user1Token}`)
					.query({ startDate: "2026-03-01", endDate: "2026-03-01" });

				// Then - 사용자 1의 데이터만 반환 (3개 중 3개 완료)
				expect(response.status).toBe(200);
				const { completions } = response.body.data;
				expect(completions.length).toBe(1);
				expect(completions[0].totalTodos).toBe(3);
				expect(completions[0].completedTodos).toBe(3);
				expect(completions[0].isComplete).toBe(true);
			});

			it("사용자 2는 자신의 데이터만 조회", async () => {
				// Given - 사용자 1 (3개 Todo, 100% 완료)과 사용자 2 (2개 Todo, 50% 완료) 준비

				// When - 사용자 2가 완료 현황 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${user2Token}`)
					.query({ startDate: "2026-03-01", endDate: "2026-03-01" });

				// Then - 사용자 2의 데이터만 반환 (2개 중 1개 완료)
				expect(response.status).toBe(200);
				const { completions } = response.body.data;
				expect(completions.length).toBe(1);
				expect(completions[0].totalTodos).toBe(2);
				expect(completions[0].completedTodos).toBe(1);
				expect(completions[0].isComplete).toBe(false);
			});
		});

		describe("Todo 상태 변경 반영", () => {
			let accessToken: string;

			beforeAll(async () => {
				const user = await ctx.helpers.createVerifiedUser(
					"state-change-test@example.com",
					"Test1234!",
				);
				accessToken = user.accessToken;
			});

			it("Todo 완료 상태 변경 시 완료 현황 즉시 반영", async () => {
				// Given - 2개의 미완료 Todo 생성
				await createTodo(accessToken, {
					title: "할 일 1",
					startDate: "2026-04-01",
					completed: false,
				});
				const { id: todoId2 } = await createTodo(accessToken, {
					title: "할 일 2",
					startDate: "2026-04-01",
					completed: false,
				});

				// When - 초기 완료 현황 조회
				let response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026-04-01", endDate: "2026-04-01" });

				// Then - 0% 완료 상태 확인
				expect(response.status).toBe(200);
				expect(response.body.data.completions[0].completedTodos).toBe(0);
				expect(response.body.data.completions[0].isComplete).toBe(false);

				// When - Todo 하나 완료 처리 후 다시 조회
				await request(ctx.app.getHttpServer())
					.patch(`/todos/${todoId2}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ completed: true })
					.expect(200);

				response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026-04-01", endDate: "2026-04-01" });

				// Then - 50% 완료 상태로 변경 확인
				expect(response.status).toBe(200);
				expect(response.body.data.completions[0].completedTodos).toBe(1);
				expect(response.body.data.completions[0].completionRate).toBe(50);
			});
		});

		describe("월간 캘린더 시나리오", () => {
			let accessToken: string;

			beforeAll(async () => {
				const user = await ctx.helpers.createVerifiedUser(
					"calendar-test@example.com",
					"Test1234!",
				);
				accessToken = user.accessToken;

				// 5월 데이터 생성 - 다양한 완료 현황
				await createTodosForDate(accessToken, "2026-05-01", 1, 1); // 100%
				await createTodosForDate(accessToken, "2026-05-05", 5, 5); // 100%
				await createTodosForDate(accessToken, "2026-05-10", 3, 2); // 66%
				await createTodosForDate(accessToken, "2026-05-15", 2, 0); // 0%
				await createTodosForDate(accessToken, "2026-05-20", 4, 4); // 100%
				await createTodosForDate(accessToken, "2026-05-25", 6, 3); // 50%
				await createTodosForDate(accessToken, "2026-05-31", 2, 2); // 100%
			});

			it("월간 조회 시 물고기 개수 정확히 계산", async () => {
				// Given - 5월에 7일간 다양한 완료율의 Todo 준비 (100% 완료 4일)

				// When - 5월 전체 기간 완료 현황 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026-05-01", endDate: "2026-05-31" });

				// Then - 7개 날짜와 4일의 100% 완료일 반환
				expect(response.status).toBe(200);
				const { completions, totalCompleteDays } = response.body.data;

				// 7개 날짜에 Todo가 있음
				expect(completions.length).toBe(7);

				// 100% 완료한 날: 5/1, 5/5, 5/20, 5/31 = 4일
				expect(totalCompleteDays).toBe(4);

				// isComplete 검증
				const completeDays = completions.filter(
					(c: { isComplete: boolean }) => c.isComplete,
				);
				expect(completeDays.length).toBe(4);
			});

			it("UI 매핑 데이터 검증 - 물고기/미완료 표시", async () => {
				// Given - 5월에 다양한 완료율의 Todo 준비

				// When - 5월 전체 기간 완료 현황 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026-05-01", endDate: "2026-05-31" });

				// Then - 각 날짜별 UI 표시 로직에 맞는 데이터 검증
				expect(response.status).toBe(200);
				const { completions } = response.body.data;

				for (const completion of completions) {
					const incompleteTodos =
						completion.totalTodos - completion.completedTodos;

					if (completion.isComplete) {
						// 물고기 표시 조건: 100% 완료
						expect(completion.completedTodos).toBe(completion.totalTodos);
						expect(incompleteTodos).toBe(0);
					} else {
						// 미완료 개수 표시 조건
						expect(incompleteTodos).toBeGreaterThan(0);
					}
				}
			});
		});
	});
});
