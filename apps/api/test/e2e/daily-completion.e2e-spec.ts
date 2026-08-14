/**
 * DailyCompletion E2E 테스트
 *
 * @description
 * 일일 완료 현황 API 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import request from "supertest";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("일일 달성 E2E", () => {
	let ctx: E2eTestContext;

	/**
	 * 테스트용 Todo 생성 헬퍼
	 */
	async function createTodo(
		accessToken: string,
		data: {
			title: string;
			startDate: string;
			completed?: boolean;
			visibility?: "PUBLIC" | "PRIVATE";
		},
	): Promise<{ id: number }> {
		const categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
		const response = await request(ctx.app.getHttpServer())
			.post("/v1/todos")
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				title: data.title,
				startDate: data.startDate,
				categoryId,
				visibility: data.visibility,
			})
			.expect(201);

		const todoId = response.body.data.todo.id;

		// completed가 true인 경우 업데이트
		if (data.completed) {
			await request(ctx.app.getHttpServer())
				.patch(`/v1/todos/${todoId}`)
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

	beforeEach(async () => {
		await ctx.reset();
	});

	const password = "Test1234!";

	describe("GET /daily-completions - 일일 완료 현황 조회", () => {
		describe("인증", () => {
			it("인증 없이 접근 시 401 반환", async () => {
				// Given - 인증되지 않은 상태

				// When - 인증 토큰 없이 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
					.query({ startDate: "2026-01-01", endDate: "2026-01-31" });

				// Then - 401 Unauthorized 반환
				expect(response.status).toBe(401);
			});

			it("잘못된 토큰으로 접근 시 401 반환", async () => {
				// Given - 유효하지 않은 토큰 준비

				// When - 잘못된 토큰으로 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
					.set("Authorization", "Bearer invalid-token")
					.query({ startDate: "2026-01-01", endDate: "2026-01-31" });

				// Then - 401 Unauthorized 반환
				expect(response.status).toBe(401);
			});
		});

		describe("파라미터 검증", () => {
			it("startDate 누락 시 400 반환", async () => {
				// Given - 인증된 사용자 준비
				const user = await ctx.helpers.createVerifiedUser("dc-param1@test.com", password);

				// When - startDate 없이 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.query({ endDate: "2026-01-31" });

				// Then - 400 Bad Request 반환
				expect(response.status).toBe(400);
				expect(response.body.success).toBe(false);
			});

			it("endDate 누락 시 400 반환", async () => {
				// Given - 인증된 사용자 준비
				const user = await ctx.helpers.createVerifiedUser("dc-param2@test.com", password);

				// When - endDate 없이 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.query({ startDate: "2026-01-01" });

				// Then - 400 Bad Request 반환
				expect(response.status).toBe(400);
				expect(response.body.success).toBe(false);
			});

			it("잘못된 날짜 형식 시 400 반환", async () => {
				// Given - 인증된 사용자 준비
				const user = await ctx.helpers.createVerifiedUser("dc-param3@test.com", password);

				// When - 잘못된 날짜 형식으로 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.query({ startDate: "2026/01/01", endDate: "2026-01-31" });

				// Then - 400 Bad Request 반환
				expect(response.status).toBe(400);
				expect(response.body.success).toBe(false);
			});

			it("endDate가 startDate보다 이전인 경우 400 반환", async () => {
				// Given - 인증된 사용자 준비
				const user = await ctx.helpers.createVerifiedUser("dc-param4@test.com", password);

				// When - endDate가 startDate보다 이전인 값으로 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.query({ startDate: "2026-01-31", endDate: "2026-01-01" });

				// Then - 400 Bad Request 반환
				expect(response.status).toBe(400);
				expect(response.body.success).toBe(false);
			});
		});

		describe("정상 조회", () => {
			it("날짜 범위 내 완료 현황 조회 성공", async () => {
				// Given - 인증된 사용자와 4개 날짜에 Todo 데이터 준비 (100% 완료 2일)
				const user = await ctx.helpers.createVerifiedUser("dc-normal1@test.com", password);
				const accessToken = user.accessToken;

				await createTodosForDate(accessToken, "2026-01-15", 3, 3);
				await createTodosForDate(accessToken, "2026-01-16", 4, 2);
				await createTodosForDate(accessToken, "2026-01-17", 2, 0);
				await createTodosForDate(accessToken, "2026-01-20", 1, 1);

				// When - 1월 전체 기간 완료 현황 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026-01-01", endDate: "2026-01-31" });

				// Then - 성공 응답과 완료 현황 데이터 반환
				expect(response.status).toBe(200);
				expect(response.body.success).toBe(true);
				expect(response.body.data).toHaveProperty("completions");
				expect(response.body.data).toHaveProperty("totalCompleteDays");
				expect(response.body.data).toHaveProperty("dateRange");

				const { completions, totalCompleteDays, dateRange } = response.body.data;

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
				const user = await ctx.helpers.createVerifiedUser("dc-normal2@test.com", password);
				const accessToken = user.accessToken;

				await createTodosForDate(accessToken, "2026-01-15", 3, 3);
				await createTodosForDate(accessToken, "2026-01-16", 4, 2);
				await createTodosForDate(accessToken, "2026-01-17", 2, 0);

				// When - 특정 3일 기간 완료 현황 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
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
				const day15 = completions.find((c: { date: string }) => c.date === "2026-01-15");
				expect(day15.totalTodos).toBe(3);
				expect(day15.completedTodos).toBe(3);
				expect(day15.isComplete).toBe(true);
				expect(day15.completionRate).toBe(100);

				// 2026-01-16: 4개 중 2개 완료
				const day16 = completions.find((c: { date: string }) => c.date === "2026-01-16");
				expect(day16.totalTodos).toBe(4);
				expect(day16.completedTodos).toBe(2);
				expect(day16.isComplete).toBe(false);
				expect(day16.completionRate).toBe(50);

				// 2026-01-17: 2개 중 0개 완료
				const day17 = completions.find((c: { date: string }) => c.date === "2026-01-17");
				expect(day17.totalTodos).toBe(2);
				expect(day17.completedTodos).toBe(0);
				expect(day17.isComplete).toBe(false);
				expect(day17.completionRate).toBe(0);
			});

			it("특정 날짜만 조회", async () => {
				// Given - 인증된 사용자와 2026-01-20에 100% 완료된 Todo 준비
				const user = await ctx.helpers.createVerifiedUser("dc-normal3@test.com", password);
				const accessToken = user.accessToken;

				await createTodosForDate(accessToken, "2026-01-20", 1, 1);

				// When - 단일 날짜 완료 현황 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
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
				const user = await ctx.helpers.createVerifiedUser("dc-normal4@test.com", password);
				const accessToken = user.accessToken;

				// When - Todo가 없는 2월 기간 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
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
			it("사용자 1은 자신의 데이터만 조회하고, 사용자 2는 자신의 데이터만 조회한다", async () => {
				// Given - 사용자 1 (3개 Todo, 100% 완료)과 사용자 2 (2개 Todo, 50% 완료) 준비
				const user1 = await ctx.helpers.createVerifiedUser("dc-iso1@test.com", password);
				const user2 = await ctx.helpers.createVerifiedUser("dc-iso2@test.com", password);
				await createTodosForDate(user1.accessToken, "2026-03-01", 3, 3);
				await createTodosForDate(user2.accessToken, "2026-03-01", 2, 1);

				// When - 사용자 1이 완료 현황 조회
				const response1 = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
					.set("Authorization", `Bearer ${user1.accessToken}`)
					.query({ startDate: "2026-03-01", endDate: "2026-03-01" });

				// Then - 사용자 1의 데이터만 반환 (3개 중 3개 완료)
				expect(response1.status).toBe(200);
				expect(response1.body.data.completions.length).toBe(1);
				expect(response1.body.data.completions[0].totalTodos).toBe(3);
				expect(response1.body.data.completions[0].completedTodos).toBe(3);
				expect(response1.body.data.completions[0].isComplete).toBe(true);

				// When - 사용자 2가 완료 현황 조회
				const response2 = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
					.set("Authorization", `Bearer ${user2.accessToken}`)
					.query({ startDate: "2026-03-01", endDate: "2026-03-01" });

				// Then - 사용자 2의 데이터만 반환 (2개 중 1개 완료)
				expect(response2.status).toBe(200);
				expect(response2.body.data.completions.length).toBe(1);
				expect(response2.body.data.completions[0].totalTodos).toBe(2);
				expect(response2.body.data.completions[0].completedTodos).toBe(1);
				expect(response2.body.data.completions[0].isComplete).toBe(false);
			});
		});

		describe("Todo 상태 변경 반영", () => {
			it("Todo 완료 상태 변경 시 완료 현황 즉시 반영", async () => {
				// Given - 2개의 미완료 Todo 생성
				const user = await ctx.helpers.createVerifiedUser("dc-state@test.com", password);
				const accessToken = user.accessToken;

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
					.get("/v1/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026-04-01", endDate: "2026-04-01" });

				// Then - 0% 완료 상태 확인
				expect(response.status).toBe(200);
				expect(response.body.data.completions[0].completedTodos).toBe(0);
				expect(response.body.data.completions[0].isComplete).toBe(false);

				// When - Todo 하나 완료 처리 후 다시 조회
				await request(ctx.app.getHttpServer())
					.patch(`/v1/todos/${todoId2}`)
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ completed: true })
					.expect(200);

				response = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
					.set("Authorization", `Bearer ${accessToken}`)
					.query({ startDate: "2026-04-01", endDate: "2026-04-01" });

				// Then - 50% 완료 상태로 변경 확인
				expect(response.status).toBe(200);
				expect(response.body.data.completions[0].completedTodos).toBe(1);
				expect(response.body.data.completions[0].completionRate).toBe(50);
			});
		});

		describe("GET /daily-completions/friends/:userId - 친구 일일 완료 현황 조회", () => {
			it("인증 없이 접근 시 401 반환", async () => {
				// Given - 인증되지 않은 상태

				// When - 인증 토큰 없이 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions/friends/clz7x5p8k0001qz0z8z8z8z8z8")
					.query({ startDate: "2026-01-01", endDate: "2026-01-31" });

				// Then - 401 Unauthorized 반환
				expect(response.status).toBe(401);
			});

			it("맞팔 관계가 아니면 403 반환", async () => {
				// Given - 팔로우 관계가 없는 두 사용자 준비
				const viewer = await ctx.helpers.createVerifiedUser("dc-friend-viewer1@test.com", password);
				const stranger = await ctx.helpers.createVerifiedUser(
					"dc-friend-stranger@test.com",
					password,
				);

				// When - 맞팔이 아닌 사용자의 완료 현황 조회
				const response = await request(ctx.app.getHttpServer())
					.get(`/v1/daily-completions/friends/${stranger.userId}`)
					.set("Authorization", `Bearer ${viewer.accessToken}`)
					.query({ startDate: "2026-01-01", endDate: "2026-01-31" });

				// Then - 403 Forbidden (FOLLOW_0906) 반환
				expect(response.status).toBe(403);
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("FOLLOW_0906");
			});

			it("맞팔이면 친구의 PUBLIC 할 일만 집계해 반환한다", async () => {
				// Given - 맞팔 관계인 두 사용자와 친구의 PUBLIC/PRIVATE 할 일 준비
				const viewer = await ctx.helpers.createVerifiedUser("dc-friend-viewer2@test.com", password);
				const friend = await ctx.helpers.createVerifiedUser("dc-friend-owner@test.com", password);
				await ctx.helpers.createFriendship(viewer, friend);

				// 6/1: PUBLIC 2개(1개 완료) + PRIVATE 1개(완료) → PUBLIC 기준 2개 중 1개
				await createTodo(friend.accessToken, {
					title: "공개 완료",
					startDate: "2026-06-01",
					completed: true,
					visibility: "PUBLIC",
				});
				await createTodo(friend.accessToken, {
					title: "공개 미완료",
					startDate: "2026-06-01",
					visibility: "PUBLIC",
				});
				await createTodo(friend.accessToken, {
					title: "비공개 완료",
					startDate: "2026-06-01",
					completed: true,
					visibility: "PRIVATE",
				});

				// 6/2: PUBLIC 1개(완료) + PRIVATE 1개(미완료) → PUBLIC 기준 100% 완료(물고기)
				await createTodo(friend.accessToken, {
					title: "공개 완료",
					startDate: "2026-06-02",
					completed: true,
					visibility: "PUBLIC",
				});
				await createTodo(friend.accessToken, {
					title: "비공개 미완료",
					startDate: "2026-06-02",
					visibility: "PRIVATE",
				});

				// 6/3: PRIVATE만 1개 → PUBLIC 기준 할 일 없는 날 (응답 미포함)
				await createTodo(friend.accessToken, {
					title: "비공개만",
					startDate: "2026-06-03",
					visibility: "PRIVATE",
				});

				// When - 친구의 6월 완료 현황 조회
				const response = await request(ctx.app.getHttpServer())
					.get(`/v1/daily-completions/friends/${friend.userId}`)
					.set("Authorization", `Bearer ${viewer.accessToken}`)
					.query({ startDate: "2026-06-01", endDate: "2026-06-30" });

				// Then - PUBLIC 기준으로만 집계되어 PRIVATE 존재가 드러나지 않음
				expect(response.status).toBe(200);
				const { completions, totalCompleteDays } = response.body.data;

				expect(completions.length).toBe(2);

				const day1 = completions.find((c: { date: string }) => c.date === "2026-06-01");
				expect(day1.totalTodos).toBe(2);
				expect(day1.completedTodos).toBe(1);
				expect(day1.isComplete).toBe(false);

				const day2 = completions.find((c: { date: string }) => c.date === "2026-06-02");
				expect(day2.totalTodos).toBe(1);
				expect(day2.completedTodos).toBe(1);
				expect(day2.isComplete).toBe(true);

				expect(totalCompleteDays).toBe(1);
			});

			it("내 완료 현황 조회는 PRIVATE을 포함해 친구용 조회와 독립적이다", async () => {
				// Given - 맞팔 친구가 PUBLIC 1개(완료) + PRIVATE 1개(미완료) 보유
				const viewer = await ctx.helpers.createVerifiedUser("dc-friend-viewer3@test.com", password);
				const friend = await ctx.helpers.createVerifiedUser("dc-friend-owner2@test.com", password);
				await ctx.helpers.createFriendship(viewer, friend);

				await createTodo(friend.accessToken, {
					title: "공개 완료",
					startDate: "2026-07-01",
					completed: true,
					visibility: "PUBLIC",
				});
				await createTodo(friend.accessToken, {
					title: "비공개 미완료",
					startDate: "2026-07-01",
					visibility: "PRIVATE",
				});

				// When - 뷰어가 친구용으로, 친구 본인이 내 것으로 각각 조회
				const friendView = await request(ctx.app.getHttpServer())
					.get(`/v1/daily-completions/friends/${friend.userId}`)
					.set("Authorization", `Bearer ${viewer.accessToken}`)
					.query({ startDate: "2026-07-01", endDate: "2026-07-01" });
				const ownerView = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
					.set("Authorization", `Bearer ${friend.accessToken}`)
					.query({ startDate: "2026-07-01", endDate: "2026-07-01" });

				// Then - 친구용은 PUBLIC 기준 완료(물고기), 본인은 전체 기준 미완료
				expect(friendView.body.data.completions[0].isComplete).toBe(true);
				expect(ownerView.body.data.completions[0].totalTodos).toBe(2);
				expect(ownerView.body.data.completions[0].isComplete).toBe(false);
			});

			it("친구용 캐시 생성 후 PUBLIC을 PRIVATE으로 바꾸면 같은 범위에서 즉시 사라진다", async () => {
				// Given - 맞팔 친구의 완료된 PUBLIC 할 일과 캐시된 친구 완료 현황
				const viewer = await ctx.helpers.createVerifiedUser(
					"dc-visibility-private-viewer@test.com",
					password,
				);
				const friend = await ctx.helpers.createVerifiedUser(
					"dc-visibility-private-owner@test.com",
					password,
				);
				await ctx.helpers.createFriendship(viewer, friend);
				const todo = await createTodo(friend.accessToken, {
					title: "공개 완료",
					startDate: "2026-08-01",
					completed: true,
					visibility: "PUBLIC",
				});
				const query = { startDate: "2026-08-01", endDate: "2026-08-01" };

				const cached = await request(ctx.app.getHttpServer())
					.get(`/v1/daily-completions/friends/${friend.userId}`)
					.set("Authorization", `Bearer ${viewer.accessToken}`)
					.query(query)
					.expect(200);
				expect(cached.body.data.completions).toHaveLength(1);

				// When - 소유자가 공개 할 일을 비공개로 변경한 뒤 같은 조건으로 재조회
				await request(ctx.app.getHttpServer())
					.patch(`/v1/todos/${todo.id}/visibility`)
					.set("Authorization", `Bearer ${friend.accessToken}`)
					.send({ visibility: "PRIVATE" })
					.expect(200);
				const refreshed = await request(ctx.app.getHttpServer())
					.get(`/v1/daily-completions/friends/${friend.userId}`)
					.set("Authorization", `Bearer ${viewer.accessToken}`)
					.query(query)
					.expect(200);

				// Then - 기존 공개 집계가 캐시 TTL 동안 노출되지 않음
				expect(refreshed.body.data.completions).toEqual([]);
				expect(refreshed.body.data.totalCompleteDays).toBe(0);
			});

			it("친구용 빈 캐시 생성 후 PRIVATE을 PUBLIC으로 바꾸면 같은 범위에 즉시 나타난다", async () => {
				// Given - 맞팔 친구의 완료된 PRIVATE 할 일과 캐시된 빈 친구 완료 현황
				const viewer = await ctx.helpers.createVerifiedUser(
					"dc-visibility-public-viewer@test.com",
					password,
				);
				const friend = await ctx.helpers.createVerifiedUser(
					"dc-visibility-public-owner@test.com",
					password,
				);
				await ctx.helpers.createFriendship(viewer, friend);
				const todo = await createTodo(friend.accessToken, {
					title: "비공개 완료",
					startDate: "2026-08-02",
					completed: true,
					visibility: "PRIVATE",
				});
				const query = { startDate: "2026-08-02", endDate: "2026-08-02" };

				const cached = await request(ctx.app.getHttpServer())
					.get(`/v1/daily-completions/friends/${friend.userId}`)
					.set("Authorization", `Bearer ${viewer.accessToken}`)
					.query(query)
					.expect(200);
				expect(cached.body.data.completions).toEqual([]);

				// When - 소유자가 비공개 할 일을 공개로 변경한 뒤 같은 조건으로 재조회
				await request(ctx.app.getHttpServer())
					.patch(`/v1/todos/${todo.id}/visibility`)
					.set("Authorization", `Bearer ${friend.accessToken}`)
					.send({ visibility: "PUBLIC" })
					.expect(200);
				const refreshed = await request(ctx.app.getHttpServer())
					.get(`/v1/daily-completions/friends/${friend.userId}`)
					.set("Authorization", `Bearer ${viewer.accessToken}`)
					.query(query)
					.expect(200);

				// Then - 빈 캐시가 제거되어 현재 공개 집계를 반환함
				expect(refreshed.body.data.completions).toHaveLength(1);
				expect(refreshed.body.data.completions[0]).toMatchObject({
					date: "2026-08-02",
					totalTodos: 1,
					completedTodos: 1,
					isComplete: true,
				});
				expect(refreshed.body.data.totalCompleteDays).toBe(1);
			});
		});

		describe("월간 캘린더 시나리오", () => {
			it("월간 조회 시 물고기 개수 정확히 계산하고 UI 매핑 데이터 검증", async () => {
				// Given - 5월에 7일간 다양한 완료율의 Todo 준비 (100% 완료 4일)
				const user = await ctx.helpers.createVerifiedUser("dc-calendar@test.com", password);
				const accessToken = user.accessToken;

				await createTodosForDate(accessToken, "2026-05-01", 1, 1); // 100%
				await createTodosForDate(accessToken, "2026-05-05", 5, 5); // 100%
				await createTodosForDate(accessToken, "2026-05-10", 3, 2); // 66%
				await createTodosForDate(accessToken, "2026-05-15", 2, 0); // 0%
				await createTodosForDate(accessToken, "2026-05-20", 4, 4); // 100%
				await createTodosForDate(accessToken, "2026-05-25", 6, 3); // 50%
				await createTodosForDate(accessToken, "2026-05-31", 2, 2); // 100%

				// When - 5월 전체 기간 완료 현황 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/daily-completions")
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
				const completeDays = completions.filter((c: { isComplete: boolean }) => c.isComplete);
				expect(completeDays.length).toBe(4);

				// Then - 각 날짜별 UI 표시 로직에 맞는 데이터 검증
				for (const completion of completions) {
					const incompleteTodos = completion.totalTodos - completion.completedTodos;

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
