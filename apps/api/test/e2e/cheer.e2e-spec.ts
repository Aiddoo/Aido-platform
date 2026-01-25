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

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "@/app.module";
import { DatabaseService } from "@/database";
import { OAuthTokenVerifierService } from "@/modules/auth/services/oauth-token-verifier.service";
import { EmailService } from "@/modules/email/email.service";
import { FakeEmailService } from "../mocks/fake-email.service";
import { FakeOAuthTokenVerifierService } from "../mocks/fake-oauth-token-verifier.service";
import { TestDatabase } from "../setup/test-database";

describe("Cheer (e2e)", () => {
	let app: INestApplication<App>;
	let testDatabase: TestDatabase;
	let fakeEmailService: FakeEmailService;
	let fakeOAuthTokenVerifierService: FakeOAuthTokenVerifierService;

	/**
	 * 테스트용 사용자 등록 및 인증 헬퍼
	 */
	async function createVerifiedUser(
		email: string,
		password: string,
	): Promise<{ accessToken: string; userId: string; userTag: string }> {
		await request(app.getHttpServer())
			.post("/auth/register")
			.send({
				email,
				password,
				passwordConfirm: password,
				termsAgreed: true,
				privacyAgreed: true,
			})
			.expect(201);

		const code = fakeEmailService.getLastCode(email);
		const response = await request(app.getHttpServer())
			.post("/auth/verify-email")
			.send({ email, code })
			.expect(200);

		return {
			accessToken: response.body.data.accessToken,
			userId: response.body.data.userId,
			userTag: response.body.data.userTag,
		};
	}

	/**
	 * 두 사용자 간 친구 관계 생성 헬퍼
	 */
	async function createFriendship(
		user1: { accessToken: string; userId: string; userTag: string },
		user2: { accessToken: string; userId: string; userTag: string },
	): Promise<void> {
		// user1 -> user2 팔로우 요청
		await request(app.getHttpServer())
			.post(`/follows/${user2.userTag}`)
			.set("Authorization", `Bearer ${user1.accessToken}`)
			.expect(201);

		// user2 -> user1 맞팔로우 (친구 성립)
		await request(app.getHttpServer())
			.post(`/follows/${user1.userTag}`)
			.set("Authorization", `Bearer ${user2.accessToken}`)
			.expect(201);
	}

	beforeAll(async () => {
		testDatabase = new TestDatabase();
		await testDatabase.start();

		fakeEmailService = new FakeEmailService();
		fakeOAuthTokenVerifierService = new FakeOAuthTokenVerifierService();

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(DatabaseService)
			.useValue(testDatabase.getPrisma())
			.overrideProvider(EmailService)
			.useValue(fakeEmailService)
			.overrideProvider(OAuthTokenVerifierService)
			.useValue(fakeOAuthTokenVerifierService)
			.compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new ZodValidationPipe());
		await app.init();
	}, 60000);

	afterAll(async () => {
		await app.close();
		await testDatabase.stop();
	});

	describe("응원 전송", () => {
		const senderEmail = "cheer-sender@example.com";
		const receiverEmail = "cheer-receiver@example.com";
		const password = "Test1234!";

		let sender: { accessToken: string; userId: string; userTag: string };
		let receiver: { accessToken: string; userId: string; userTag: string };

		beforeAll(async () => {
			sender = await createVerifiedUser(senderEmail, password);
			receiver = await createVerifiedUser(receiverEmail, password);
			await createFriendship(sender, receiver);
		});

		describe("POST /cheers - 응원 보내기", () => {
			it("친구에게 응원을 보낸다", async () => {
				const response = await request(app.getHttpServer())
					.post("/cheers")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({
						receiverId: receiver.userId,
						message: "화이팅!",
					})
					.expect(201);

				expect(response.body.success).toBe(true);
				expect(response.body.data.cheer.id).toBeDefined();
				expect(response.body.data.cheer.senderId).toBe(sender.userId);
				expect(response.body.data.cheer.receiverId).toBe(receiver.userId);
				expect(response.body.data.cheer.message).toBe("화이팅!");
			});

			it("메시지 없이도 응원을 보낼 수 있다", async () => {
				// 새로운 친구 쌍 생성 (쿨다운 회피)
				const sender2 = await createVerifiedUser(
					"cheer-sender2@example.com",
					password,
				);
				const receiver2 = await createVerifiedUser(
					"cheer-receiver2@example.com",
					password,
				);
				await createFriendship(sender2, receiver2);

				const response = await request(app.getHttpServer())
					.post("/cheers")
					.set("Authorization", `Bearer ${sender2.accessToken}`)
					.send({ receiverId: receiver2.userId })
					.expect(201);

				expect(response.body.success).toBe(true);
				expect(response.body.data.cheer.id).toBeDefined();
			});

			it("친구가 아닌 사용자에게 응원 시 403 에러 반환", async () => {
				const stranger = await createVerifiedUser(
					"cheer-stranger@example.com",
					password,
				);

				const response = await request(app.getHttpServer())
					.post("/cheers")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: stranger.userId })
					.expect(403);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("CHEER_1203");
			});

			it("자기 자신에게 응원 시 400 에러 반환", async () => {
				const response = await request(app.getHttpServer())
					.post("/cheers")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: sender.userId })
					.expect(400);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("CHEER_1204");
			});

			it("쿨다운 기간 내 동일 대상에게 다시 응원 시 429 에러 반환", async () => {
				const response = await request(app.getHttpServer())
					.post("/cheers")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: receiver.userId })
					.expect(429);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("CHEER_1202");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer())
					.post("/cheers")
					.send({ receiverId: receiver.userId })
					.expect(401);
			});
		});
	});

	describe("응원 목록 조회", () => {
		const senderEmail = "cheer-list-sender@example.com";
		const receiverEmail = "cheer-list-receiver@example.com";
		const password = "Test1234!";

		let sender: { accessToken: string; userId: string; userTag: string };
		let receiver: { accessToken: string; userId: string; userTag: string };

		beforeAll(async () => {
			sender = await createVerifiedUser(senderEmail, password);
			receiver = await createVerifiedUser(receiverEmail, password);
			await createFriendship(sender, receiver);

			// 테스트용 응원 생성
			await request(app.getHttpServer())
				.post("/cheers")
				.set("Authorization", `Bearer ${sender.accessToken}`)
				.send({
					receiverId: receiver.userId,
					message: "테스트 응원",
				});
		});

		describe("GET /cheers/received - 받은 응원 목록", () => {
			it("받은 응원 목록을 조회한다", async () => {
				const response = await request(app.getHttpServer())
					.get("/cheers/received")
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.cheers).toBeInstanceOf(Array);
				expect(response.body.data.cheers.length).toBeGreaterThanOrEqual(1);
				expect(response.body.data.hasMore).toBeDefined();
			});

			it("limit 파라미터로 조회 개수를 제한한다", async () => {
				const response = await request(app.getHttpServer())
					.get("/cheers/received")
					.query({ limit: 1 })
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.cheers).toBeInstanceOf(Array);
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer()).get("/cheers/received").expect(401);
			});
		});

		describe("GET /cheers/sent - 보낸 응원 목록", () => {
			it("보낸 응원 목록을 조회한다", async () => {
				const response = await request(app.getHttpServer())
					.get("/cheers/sent")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.expect(200);

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

		let user: { accessToken: string; userId: string; userTag: string };
		let friend: { accessToken: string; userId: string; userTag: string };

		beforeAll(async () => {
			user = await createVerifiedUser(userEmail, password);
			friend = await createVerifiedUser(friendEmail, password);
			await createFriendship(user, friend);
		});

		describe("GET /cheers/limit - 일일 제한 정보 조회", () => {
			it("일일 제한 정보를 조회한다", async () => {
				const response = await request(app.getHttpServer())
					.get("/cheers/limit")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.usedToday).toBeDefined();
				expect(response.body.data.remainingToday).toBeDefined();
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer()).get("/cheers/limit").expect(401);
			});
		});

		describe("GET /cheers/cooldown/:userId - 쿨다운 상태 조회", () => {
			it("쿨다운 상태를 조회한다", async () => {
				const response = await request(app.getHttpServer())
					.get(`/cheers/cooldown/${friend.userId}`)
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(typeof response.body.data.canCheer).toBe("boolean");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer())
					.get(`/cheers/cooldown/${friend.userId}`)
					.expect(401);
			});
		});
	});

	describe("읽음 처리", () => {
		const senderEmail = "cheer-read-sender@example.com";
		const receiverEmail = "cheer-read-receiver@example.com";
		const password = "Test1234!";

		let sender: { accessToken: string; userId: string; userTag: string };
		let receiver: { accessToken: string; userId: string; userTag: string };
		let cheerId: number;

		beforeAll(async () => {
			sender = await createVerifiedUser(senderEmail, password);
			receiver = await createVerifiedUser(receiverEmail, password);
			await createFriendship(sender, receiver);

			// 테스트용 응원 생성
			const response = await request(app.getHttpServer())
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
				const response = await request(app.getHttpServer())
					.patch(`/cheers/${cheerId}/read`)
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.readCount).toBe(1);
			});

			it("존재하지 않는 응원 읽음 처리 시 404 에러 반환", async () => {
				const response = await request(app.getHttpServer())
					.patch("/cheers/99999/read")
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(404);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("CHEER_1205");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer())
					.patch(`/cheers/${cheerId}/read`)
					.expect(401);
			});
		});

		describe("PATCH /cheers/read - 여러 응원 읽음 처리", () => {
			let newCheerId: number;

			beforeAll(async () => {
				// 새 응원 생성
				const sender2 = await createVerifiedUser(
					"cheer-read-sender2@example.com",
					password,
				);
				await createFriendship(sender2, receiver);

				const response = await request(app.getHttpServer())
					.post("/cheers")
					.set("Authorization", `Bearer ${sender2.accessToken}`)
					.send({ receiverId: receiver.userId });

				newCheerId = response.body.data.cheer.id;
			});

			it("여러 응원을 한번에 읽음 처리한다", async () => {
				const response = await request(app.getHttpServer())
					.patch("/cheers/read")
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.send({ cheerIds: [newCheerId] })
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(typeof response.body.data.readCount).toBe("number");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer())
					.patch("/cheers/read")
					.send({ cheerIds: [newCheerId] })
					.expect(401);
			});
		});
	});
});
