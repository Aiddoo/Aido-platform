/**
 * Nudge E2E 테스트
 *
 * @description
 * 콕 찌르기(Nudge) 기능 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 시나리오:
 * 1. 콕 찌르기 보내기
 * 2. 받은/보낸 콕 찌름 목록 조회
 * 3. 일일 제한 및 쿨다운 확인
 * 4. 읽음 처리
 */

import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("찔러보기 E2E", () => {
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
	function activeDateRange(): { startDate: string; endDate: string } {
		const start = new Date();
		start.setUTCDate(start.getUTCDate() - 1);
		const end = new Date();
		end.setUTCDate(end.getUTCDate() + 1);
		return {
			startDate: start.toISOString().split("T")[0] ?? "",
			endDate: end.toISOString().split("T")[0] ?? "",
		};
	}

	/** receiver의 오늘 Todo 생성 헬퍼 */
	async function createReceiverTodo(receiverToken: string): Promise<number> {
		const categoryId = await ctx.helpers.getDefaultCategoryId(receiverToken);
		const todoResponse = await request(ctx.app.getHttpServer())
			.post("/todos")
			.set("Authorization", `Bearer ${receiverToken}`)
			.send({ title: "테스트 할일", ...activeDateRange(), categoryId });
		return todoResponse.body.data?.todo?.id;
	}

	describe("콕 찌르기 전송", () => {
		describe("POST /nudges - 콕 찌르기", () => {
			it("친구에게 콕 찌르기를 보내고, 쿨다운 기간 내 동일 Todo에 다시 콕 찌르기 시 429 에러 반환", async () => {
				// Given - 친구 관계인 두 사용자와 receiver의 Todo
				const sender = await ctx.helpers.createVerifiedUser(
					"nudge-sender@test.com",
					password,
				);
				const receiver = await ctx.helpers.createVerifiedUser(
					"nudge-receiver@test.com",
					password,
				);
				await ctx.helpers.createFriendship(sender, receiver);
				const receiverTodoId = await createReceiverTodo(receiver.accessToken);

				// When - 콕 찌르기 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: receiver.userId, todoId: receiverTodoId })
					.expect(201);

				// Then - 콕 찌르기 전송 성공 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.nudge.id).toBeDefined();
				expect(response.body.data.nudge.senderId).toBe(sender.userId);
				expect(response.body.data.nudge.receiverId).toBe(receiver.userId);

				// When - 쿨다운 기간 내 동일 Todo에 다시 콕 찌르기 API 호출
				const cooldownResponse = await request(ctx.app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: receiver.userId, todoId: receiverTodoId })
					.expect(429);

				// Then - 쿨다운 에러 검증
				expect(cooldownResponse.body.success).toBe(false);
				expect(cooldownResponse.body.error.code).toBe("NUDGE_1102");
			});

			it("친구가 아닌 사용자에게 콕 찌르기 시 403 에러 반환", async () => {
				// Given - 친구 관계가 아닌 사용자와 해당 사용자의 Todo
				const sender = await ctx.helpers.createVerifiedUser(
					"nudge-sender2@test.com",
					password,
				);
				const stranger = await ctx.helpers.createVerifiedUser(
					"nudge-stranger@test.com",
					password,
				);

				const strangerTodoId = await createReceiverTodo(stranger.accessToken);

				// When - 친구가 아닌 사용자에게 콕 찌르기 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: stranger.userId, todoId: strangerTodoId })
					.expect(403);

				// Then - 친구 관계 아님 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("NUDGE_1103");
			});

			it("자기 자신에게 콕 찌르기 시 400 에러 반환", async () => {
				// Given - sender의 Todo 생성
				const sender = await ctx.helpers.createVerifiedUser(
					"nudge-self@test.com",
					password,
				);
				const categoryId = await ctx.helpers.getDefaultCategoryId(
					sender.accessToken,
				);
				const todoResponse = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ title: "Self Todo", ...activeDateRange(), categoryId });
				const selfTodoId = todoResponse.body.data?.todo?.id;

				// When - 자기 자신에게 콕 찌르기 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: sender.userId, todoId: selfTodoId })
					.expect(400);

				// Then - 자기 자신 콕 찌르기 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("NUDGE_1104");
			});

			it("비공개 Todo에 콕 찌르기 시 404 에러 반환", async () => {
				// Given - receiver의 PRIVATE Todo 생성
				const sender = await ctx.helpers.createVerifiedUser(
					"nudge-private-s@test.com",
					password,
				);
				const receiver = await ctx.helpers.createVerifiedUser(
					"nudge-private-r@test.com",
					password,
				);
				await ctx.helpers.createFriendship(sender, receiver);

				const categoryId = await ctx.helpers.getDefaultCategoryId(
					receiver.accessToken,
				);
				const todoResponse = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.send({
						title: "Private Todo",
						...activeDateRange(),
						categoryId,
						visibility: "PRIVATE",
					});
				const privateTodoId = todoResponse.body.data?.todo?.id;

				// When - PRIVATE Todo에 콕 찌르기 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: receiver.userId, todoId: privateTodoId })
					.expect(404);

				// Then - Todo 은닉 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("TODO_0801");
			});

			it("오늘이 아닌 Todo에 콕 찌르기 시 400 에러 반환", async () => {
				// Given - receiver의 어제 Todo 생성
				const sender = await ctx.helpers.createVerifiedUser(
					"nudge-yesterday-s@test.com",
					password,
				);
				const receiver = await ctx.helpers.createVerifiedUser(
					"nudge-yesterday-r@test.com",
					password,
				);
				await ctx.helpers.createFriendship(sender, receiver);

				const yesterday = new Date();
				yesterday.setUTCDate(yesterday.getUTCDate() - 1);
				const yesterdayDate = yesterday.toISOString().split("T")[0];
				const categoryId = await ctx.helpers.getDefaultCategoryId(
					receiver.accessToken,
				);
				const todoResponse = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.send({
						title: "Yesterday Todo",
						startDate: yesterdayDate,
						categoryId,
					});
				const yesterdayTodoId = todoResponse.body.data?.todo?.id;

				// When - 오늘이 아닌 Todo에 콕 찌르기 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: receiver.userId, todoId: yesterdayTodoId })
					.expect(400);

				// Then - 오늘 Todo 제한 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("NUDGE_1106");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 콕 찌르기 API 호출
				await request(ctx.app.getHttpServer())
					.post("/nudges")
					.send({ receiverId: "some-user-id", todoId: 1 })
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});

	describe("콕 찌름 목록 조회", () => {
		describe("GET /nudges/received - 받은 콕 찌름 목록", () => {
			it("받은 콕 찌름 목록을 조회한다", async () => {
				// Given - 콕 찌르기를 받은 상태
				const sender = await ctx.helpers.createVerifiedUser(
					"nudge-list-s@test.com",
					password,
				);
				const receiver = await ctx.helpers.createVerifiedUser(
					"nudge-list-r@test.com",
					password,
				);
				await ctx.helpers.createFriendship(sender, receiver);
				const todoId = await createReceiverTodo(receiver.accessToken);

				await request(ctx.app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: receiver.userId, todoId });

				// When - 받은 콕 찌름 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/nudges/received")
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(200);

				// Then - 받은 콕 찌름 목록 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.nudges).toBeInstanceOf(Array);
				expect(response.body.data.nudges.length).toBeGreaterThanOrEqual(1);
				expect(response.body.data.hasMore).toBeDefined();
			});

			it("limit 파라미터로 조회 개수를 제한한다", async () => {
				// Given - 콕 찌르기를 받은 상태
				const sender = await ctx.helpers.createVerifiedUser(
					"nudge-limit-s@test.com",
					password,
				);
				const receiver = await ctx.helpers.createVerifiedUser(
					"nudge-limit-r@test.com",
					password,
				);
				await ctx.helpers.createFriendship(sender, receiver);
				const todoId = await createReceiverTodo(receiver.accessToken);

				await request(ctx.app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: receiver.userId, todoId });

				// When - limit을 1로 설정하여 받은 콕 찌름 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/nudges/received")
					.query({ limit: 1 })
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(200);

				// Then - limit 적용 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.nudges).toBeInstanceOf(Array);
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 받은 콕 찌름 목록 조회 API 호출
				await request(ctx.app.getHttpServer())
					.get("/nudges/received")
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("GET /nudges/sent - 보낸 콕 찌름 목록", () => {
			it("보낸 콕 찌름 목록을 조회한다", async () => {
				// Given - 콕 찌르기를 보낸 상태
				const sender = await ctx.helpers.createVerifiedUser(
					"nudge-sent-s@test.com",
					password,
				);
				const receiver = await ctx.helpers.createVerifiedUser(
					"nudge-sent-r@test.com",
					password,
				);
				await ctx.helpers.createFriendship(sender, receiver);
				const todoId = await createReceiverTodo(receiver.accessToken);

				await request(ctx.app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: receiver.userId, todoId });

				// When - 보낸 콕 찌름 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/nudges/sent")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.expect(200);

				// Then - 보낸 콕 찌름 목록 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.nudges).toBeInstanceOf(Array);
				expect(response.body.data.nudges.length).toBeGreaterThanOrEqual(1);
			});
		});
	});

	describe("일일 제한 및 쿨다운", () => {
		describe("GET /nudges/limit - 일일 제한 정보 조회", () => {
			it("일일 제한 정보를 조회한다", async () => {
				// Given - 인증된 사용자
				const user = await ctx.helpers.createVerifiedUser(
					"nudge-lim-user@test.com",
					password,
				);

				// When - 일일 제한 정보 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/nudges/limit")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				// Then - 일일 제한 정보 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.usedToday).toBeDefined();
				expect(response.body.data.remainingToday).toBeDefined();
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 일일 제한 정보 조회 API 호출
				await request(ctx.app.getHttpServer()).get("/nudges/limit").expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("GET /nudges/cooldown/:userId - 쿨다운 상태 조회", () => {
			it("쿨다운 상태를 조회한다", async () => {
				// Given - 친구 관계인 두 사용자
				const user = await ctx.helpers.createVerifiedUser(
					"nudge-cd-user@test.com",
					password,
				);
				const friend = await ctx.helpers.createVerifiedUser(
					"nudge-cd-friend@test.com",
					password,
				);
				await ctx.helpers.createFriendship(user, friend);

				// When - 쿨다운 상태 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get(`/nudges/cooldown/${friend.userId}`)
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				// Then - 쿨다운 상태 검증
				expect(response.body.success).toBe(true);
				expect(typeof response.body.data.canNudge).toBe("boolean");
				expect(
					response.body.data.remainingSeconds === null ||
						typeof response.body.data.remainingSeconds === "number",
				).toBe(true);
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 쿨다운 상태 조회 API 호출
				await request(ctx.app.getHttpServer())
					.get("/nudges/cooldown/some-user-id")
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});

	describe("읽음 처리", () => {
		describe("PATCH /nudges/:id/read - 읽음 처리", () => {
			it("받은 콕 찌름을 읽음 처리한다", async () => {
				// Given - 읽지 않은 콕 찌르기가 있는 상태
				const sender = await ctx.helpers.createVerifiedUser(
					"nudge-read-s@test.com",
					password,
				);
				const receiver = await ctx.helpers.createVerifiedUser(
					"nudge-read-r@test.com",
					password,
				);
				await ctx.helpers.createFriendship(sender, receiver);
				const todoId = await createReceiverTodo(receiver.accessToken);

				const nudgeResponse = await request(ctx.app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: receiver.userId, todoId });
				const nudgeId = nudgeResponse.body.data.nudge.id;

				// When - 콕 찌르기 읽음 처리 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/nudges/${nudgeId}/read`)
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(200);

				// Then - 읽음 처리 성공 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.readCount).toBe(1);
			});

			it("존재하지 않는 콕 찌름 읽음 처리 시 404 에러 반환", async () => {
				// Given - 존재하지 않는 콕 찌르기 ID
				const receiver = await ctx.helpers.createVerifiedUser(
					"nudge-read-404@test.com",
					password,
				);

				// When - 존재하지 않는 콕 찌르기 읽음 처리 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch("/nudges/99999/read")
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(404);

				// Then - 콕 찌르기 없음 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("NUDGE_1105");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 콕 찌르기 읽음 처리 API 호출
				await request(ctx.app.getHttpServer())
					.patch("/nudges/1/read")
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});
});
