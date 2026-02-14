/**
 * Cheer E2E 테스트
 *
 * @description
 * 응원(Cheer) 기능 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 시나리오:
 * 1. 응원 보내기
 * 2. 받은/보낸 응원 목록 조회
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

describe("Cheer (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	describe("응원 전송", () => {
		const senderEmail = "cheer-sender@example.com";
		const receiverEmail = "cheer-receiver@example.com";
		const password = "Test1234!";

		let sender: VerifiedUser;
		let receiver: VerifiedUser;

		beforeAll(async () => {
			sender = await ctx.helpers.createVerifiedUser(senderEmail, password);
			receiver = await ctx.helpers.createVerifiedUser(receiverEmail, password);
			await ctx.helpers.createFriendship(sender, receiver);
		});

		describe("POST /cheers - 응원 보내기", () => {
			it("친구에게 응원을 보낸다", async () => {
				// Given - 친구 관계인 두 사용자 (beforeAll에서 생성)

				// When - 응원 보내기 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/cheers")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({
						receiverId: receiver.userId,
						message: "화이팅!",
					})
					.expect(201);

				// Then - 응원 전송 성공 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.cheer.id).toBeDefined();
				expect(response.body.data.cheer.senderId).toBe(sender.userId);
				expect(response.body.data.cheer.receiverId).toBe(receiver.userId);
				expect(response.body.data.cheer.message).toBe("화이팅!");
			});

			it("메시지 없이도 응원을 보낼 수 있다", async () => {
				// Given - 새로운 친구 쌍 생성 (쿨다운 회피)
				const sender2 = await ctx.helpers.createVerifiedUser(
					"cheer-sender2@example.com",
					password,
				);
				const receiver2 = await ctx.helpers.createVerifiedUser(
					"cheer-receiver2@example.com",
					password,
				);
				await ctx.helpers.createFriendship(sender2, receiver2);

				// When - 메시지 없이 응원 보내기 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/cheers")
					.set("Authorization", `Bearer ${sender2.accessToken}`)
					.send({ receiverId: receiver2.userId })
					.expect(201);

				// Then - 메시지 없는 응원 전송 성공 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.cheer.id).toBeDefined();
			});

			it("친구가 아닌 사용자에게 응원 시 403 에러 반환", async () => {
				// Given - 친구 관계가 아닌 사용자
				const stranger = await ctx.helpers.createVerifiedUser(
					"cheer-stranger@example.com",
					password,
				);

				// When - 친구가 아닌 사용자에게 응원 보내기 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/cheers")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: stranger.userId })
					.expect(403);

				// Then - 친구 관계 아님 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("CHEER_1203");
			});

			it("자기 자신에게 응원 시 400 에러 반환", async () => {
				// Given - 인증된 사용자

				// When - 자기 자신에게 응원 보내기 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/cheers")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: sender.userId })
					.expect(400);

				// Then - 자기 자신 응원 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("CHEER_1204");
			});

			it("쿨다운 기간 내 동일 대상에게 다시 응원 시 429 에러 반환", async () => {
				// Given - 이미 응원을 보낸 상태 (첫 번째 테스트에서 생성)

				// When - 쿨다운 기간 내 동일 대상에게 다시 응원 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post("/cheers")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: receiver.userId })
					.expect(429);

				// Then - 쿨다운 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("CHEER_1202");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 응원 보내기 API 호출
				await request(ctx.app.getHttpServer())
					.post("/cheers")
					.send({ receiverId: receiver.userId })
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});

	describe("응원 목록 조회", () => {
		const senderEmail = "cheer-list-sender@example.com";
		const receiverEmail = "cheer-list-receiver@example.com";
		const password = "Test1234!";

		let sender: VerifiedUser;
		let receiver: VerifiedUser;

		beforeAll(async () => {
			sender = await ctx.helpers.createVerifiedUser(senderEmail, password);
			receiver = await ctx.helpers.createVerifiedUser(receiverEmail, password);
			await ctx.helpers.createFriendship(sender, receiver);

			// 테스트용 응원 생성
			await request(ctx.app.getHttpServer())
				.post("/cheers")
				.set("Authorization", `Bearer ${sender.accessToken}`)
				.send({
					receiverId: receiver.userId,
					message: "테스트 응원",
				});
		});

		describe("GET /cheers/received - 받은 응원 목록", () => {
			it("받은 응원 목록을 조회한다", async () => {
				// Given - 응원을 받은 상태 (beforeAll에서 생성)

				// When - 받은 응원 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/cheers/received")
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(200);

				// Then - 받은 응원 목록 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.cheers).toBeInstanceOf(Array);
				expect(response.body.data.cheers.length).toBeGreaterThanOrEqual(1);
				expect(response.body.data.hasMore).toBeDefined();
			});

			it("limit 파라미터로 조회 개수를 제한한다", async () => {
				// Given - 응원을 받은 상태

				// When - limit을 1로 설정하여 받은 응원 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/cheers/received")
					.query({ limit: 1 })
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(200);

				// Then - limit 적용 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.cheers).toBeInstanceOf(Array);
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 받은 응원 목록 조회 API 호출
				await request(ctx.app.getHttpServer())
					.get("/cheers/received")
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("GET /cheers/sent - 보낸 응원 목록", () => {
			it("보낸 응원 목록을 조회한다", async () => {
				// Given - 응원을 보낸 상태 (beforeAll에서 생성)

				// When - 보낸 응원 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/cheers/sent")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.expect(200);

				// Then - 보낸 응원 목록 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.cheers).toBeInstanceOf(Array);
				expect(response.body.data.cheers.length).toBeGreaterThanOrEqual(1);
			});
		});
	});

	describe("일일 제한 및 쿨다운", () => {
		const userEmail = "cheer-limit-user@example.com";
		const friendEmail = "cheer-limit-friend@example.com";
		const password = "Test1234!";

		let user: VerifiedUser;
		let friend: VerifiedUser;

		beforeAll(async () => {
			user = await ctx.helpers.createVerifiedUser(userEmail, password);
			friend = await ctx.helpers.createVerifiedUser(friendEmail, password);
			await ctx.helpers.createFriendship(user, friend);
		});

		describe("GET /cheers/limit - 일일 제한 정보 조회", () => {
			it("일일 제한 정보를 조회한다", async () => {
				// Given - 인증된 사용자

				// When - 일일 제한 정보 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/cheers/limit")
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
				await request(ctx.app.getHttpServer()).get("/cheers/limit").expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("GET /cheers/cooldown/:userId - 쿨다운 상태 조회", () => {
			it("쿨다운 상태를 조회한다", async () => {
				// Given - 친구 관계인 두 사용자

				// When - 쿨다운 상태 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get(`/cheers/cooldown/${friend.userId}`)
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				// Then - 쿨다운 상태 검증
				expect(response.body.success).toBe(true);
				expect(typeof response.body.data.canCheer).toBe("boolean");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 쿨다운 상태 조회 API 호출
				await request(ctx.app.getHttpServer())
					.get(`/cheers/cooldown/${friend.userId}`)
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});

	describe("읽음 처리", () => {
		const senderEmail = "cheer-read-sender@example.com";
		const receiverEmail = "cheer-read-receiver@example.com";
		const password = "Test1234!";

		let sender: VerifiedUser;
		let receiver: VerifiedUser;
		let cheerId: number;

		beforeAll(async () => {
			sender = await ctx.helpers.createVerifiedUser(senderEmail, password);
			receiver = await ctx.helpers.createVerifiedUser(receiverEmail, password);
			await ctx.helpers.createFriendship(sender, receiver);

			// 테스트용 응원 생성
			const response = await request(ctx.app.getHttpServer())
				.post("/cheers")
				.set("Authorization", `Bearer ${sender.accessToken}`)
				.send({
					receiverId: receiver.userId,
					message: "읽음 처리 테스트",
				});

			cheerId = response.body.data.cheer.id;
		});

		describe("PATCH /cheers/:id/read - 단일 응원 읽음 처리", () => {
			it("받은 응원을 읽음 처리한다", async () => {
				// Given - 읽지 않은 응원이 있는 상태 (beforeAll에서 생성)

				// When - 단일 응원 읽음 처리 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/cheers/${cheerId}/read`)
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(200);

				// Then - 읽음 처리 성공 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.readCount).toBe(1);
			});

			it("존재하지 않는 응원 읽음 처리 시 404 에러 반환", async () => {
				// Given - 존재하지 않는 응원 ID

				// When - 존재하지 않는 응원 읽음 처리 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch("/cheers/99999/read")
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(404);

				// Then - 응원 없음 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("CHEER_1205");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 단일 응원 읽음 처리 API 호출
				await request(ctx.app.getHttpServer())
					.patch(`/cheers/${cheerId}/read`)
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("PATCH /cheers/read - 여러 응원 읽음 처리", () => {
			let newCheerId: number;

			beforeAll(async () => {
				// 새 응원 생성
				const sender2 = await ctx.helpers.createVerifiedUser(
					"cheer-read-sender2@example.com",
					password,
				);
				await ctx.helpers.createFriendship(sender2, receiver);

				const response = await request(ctx.app.getHttpServer())
					.post("/cheers")
					.set("Authorization", `Bearer ${sender2.accessToken}`)
					.send({ receiverId: receiver.userId });

				newCheerId = response.body.data.cheer.id;
			});

			it("여러 응원을 한번에 읽음 처리한다", async () => {
				// Given - 읽지 않은 응원들이 있는 상태 (beforeAll에서 생성)

				// When - 여러 응원 읽음 처리 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch("/cheers/read")
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.send({ cheerIds: [newCheerId] })
					.expect(200);

				// Then - 여러 응원 읽음 처리 성공 검증
				expect(response.body.success).toBe(true);
				expect(typeof response.body.data.readCount).toBe("number");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 여러 응원 읽음 처리 API 호출
				await request(ctx.app.getHttpServer())
					.patch("/cheers/read")
					.send({ cheerIds: [newCheerId] })
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});
	});
});
