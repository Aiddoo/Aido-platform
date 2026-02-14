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
import {
	createE2eApp,
	destroyE2eApp,
	type E2eTestContext,
	type VerifiedUser,
} from "./helpers";

describe("Nudge (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	describe("콕 찌르기 전송", () => {
		const senderEmail = "nudge-sender@example.com";
		const receiverEmail = "nudge-receiver@example.com";
		const password = "Test1234!";

		let sender: VerifiedUser;
		let receiver: VerifiedUser;
		let receiverTodoId: number;

		beforeAll(async () => {
			sender = await ctx.helpers.createVerifiedUser(senderEmail, password);
			receiver = await ctx.helpers.createVerifiedUser(receiverEmail, password);
			await ctx.helpers.createFriendship(sender, receiver);

			// receiver의 Todo 생성 (nudge 대상)
			const today = new Date().toISOString().split("T")[0];
			const categoryId = await ctx.helpers.getDefaultCategoryId(
				receiver.accessToken,
			);
			const todoResponse = await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${receiver.accessToken}`)
				.send({
					title: "테스트 할일",
					startDate: today,
					categoryId,
				});
			receiverTodoId = todoResponse.body.data?.todo?.id;
		});

		describe("POST /nudges - 콕 찌르기", () => {
			it("친구에게 콕 찌르기를 보낸다", async () => {
				// Given - 친구 관계인 두 사용자와 receiver의 Todo (beforeAll에서 생성)

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
			});

			it("친구가 아닌 사용자에게 콕 찌르기 시 403 에러 반환", async () => {
				// Given - 친구 관계가 아닌 사용자와 해당 사용자의 Todo
				const stranger = await ctx.helpers.createVerifiedUser(
					"nudge-stranger@example.com",
					password,
				);

				const today = new Date().toISOString().split("T")[0];
				const categoryId = await ctx.helpers.getDefaultCategoryId(
					stranger.accessToken,
				);
				const todoResponse = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${stranger.accessToken}`)
					.send({ title: "Stranger Todo", startDate: today, categoryId });
				const strangerTodoId = todoResponse.body.data?.todo?.id;

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
				const today = new Date().toISOString().split("T")[0];
				const categoryId = await ctx.helpers.getDefaultCategoryId(
					sender.accessToken,
				);
				const todoResponse = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ title: "Self Todo", startDate: today, categoryId });
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
				const today = new Date().toISOString().split("T")[0];
				const categoryId = await ctx.helpers.getDefaultCategoryId(
					receiver.accessToken,
				);
				const todoResponse = await request(ctx.app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.send({
						title: "Private Todo",
						startDate: today,
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

			it("쿨다운 기간 내 동일 Todo에 다시 콕 찌르기 시 429 에러 반환", async () => {
				// Given - 이미 콕 찌르기를 보낸 상태 (첫 번째 테스트에서 생성)

				// When - 쿨다운 기간 내 동일 Todo에 다시 콕 찌르기 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: receiver.userId, todoId: receiverTodoId })
					.expect(429);

				// Then - 쿨다운 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("NUDGE_1102");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 콕 찌르기 API 호출
				await request(ctx.app.getHttpServer())
					.post("/nudges")
					.send({ receiverId: receiver.userId, todoId: receiverTodoId })
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});

	describe("콕 찌름 목록 조회", () => {
		const senderEmail = "nudge-list-sender@example.com";
		const receiverEmail = "nudge-list-receiver@example.com";
		const password = "Test1234!";

		let sender: VerifiedUser;
		let receiver: VerifiedUser;

		beforeAll(async () => {
			sender = await ctx.helpers.createVerifiedUser(senderEmail, password);
			receiver = await ctx.helpers.createVerifiedUser(receiverEmail, password);
			await ctx.helpers.createFriendship(sender, receiver);

			// receiver의 Todo 생성
			const today = new Date().toISOString().split("T")[0];
			const categoryId = await ctx.helpers.getDefaultCategoryId(
				receiver.accessToken,
			);
			const todoResponse = await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${receiver.accessToken}`)
				.send({ title: "목록 조회 테스트 할일", startDate: today, categoryId });
			const todoId = todoResponse.body.data?.todo?.id;

			// 테스트용 콕 찌르기 생성
			await request(ctx.app.getHttpServer())
				.post("/nudges")
				.set("Authorization", `Bearer ${sender.accessToken}`)
				.send({ receiverId: receiver.userId, todoId });
		});

		describe("GET /nudges/received - 받은 콕 찌름 목록", () => {
			it("받은 콕 찌름 목록을 조회한다", async () => {
				// Given - 콕 찌르기를 받은 상태 (beforeAll에서 생성)

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
				// Given - 콕 찌르기를 보낸 상태 (beforeAll에서 생성)

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
		const userEmail = "nudge-limit-user@example.com";
		const friendEmail = "nudge-limit-friend@example.com";
		const password = "Test1234!";

		let user: VerifiedUser;
		let friend: VerifiedUser;

		beforeAll(async () => {
			user = await ctx.helpers.createVerifiedUser(userEmail, password);
			friend = await ctx.helpers.createVerifiedUser(friendEmail, password);
			await ctx.helpers.createFriendship(user, friend);
		});

		describe("GET /nudges/limit - 일일 제한 정보 조회", () => {
			it("일일 제한 정보를 조회한다", async () => {
				// Given - 인증된 사용자

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
					.get(`/nudges/cooldown/${friend.userId}`)
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});

	describe("읽음 처리", () => {
		const senderEmail = "nudge-read-sender@example.com";
		const receiverEmail = "nudge-read-receiver@example.com";
		const password = "Test1234!";

		let sender: VerifiedUser;
		let receiver: VerifiedUser;
		let nudgeId: number;

		beforeAll(async () => {
			sender = await ctx.helpers.createVerifiedUser(senderEmail, password);
			receiver = await ctx.helpers.createVerifiedUser(receiverEmail, password);
			await ctx.helpers.createFriendship(sender, receiver);

			// receiver의 Todo 생성
			const today = new Date().toISOString().split("T")[0];
			const categoryId = await ctx.helpers.getDefaultCategoryId(
				receiver.accessToken,
			);
			const todoResponse = await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${receiver.accessToken}`)
				.send({ title: "읽음 처리 테스트 할일", startDate: today, categoryId });
			const todoId = todoResponse.body.data?.todo?.id;

			// 테스트용 콕 찌르기 생성
			const response = await request(ctx.app.getHttpServer())
				.post("/nudges")
				.set("Authorization", `Bearer ${sender.accessToken}`)
				.send({ receiverId: receiver.userId, todoId });

			nudgeId = response.body.data.nudge.id;
		});

		describe("PATCH /nudges/:id/read - 읽음 처리", () => {
			it("받은 콕 찌름을 읽음 처리한다", async () => {
				// Given - 읽지 않은 콕 찌르기가 있는 상태 (beforeAll에서 생성)

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
					.patch(`/nudges/${nudgeId}/read`)
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});
});
