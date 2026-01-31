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

describe("Nudge (e2e)", () => {
	let app: INestApplication<App>;
	let testDatabase: TestDatabase;
	let fakeEmailService: FakeEmailService;
	let fakeOAuthTokenVerifierService: FakeOAuthTokenVerifierService;

	/**
	 * 기본 카테고리 ID 조회 헬퍼
	 */
	async function getDefaultCategoryId(accessToken: string): Promise<number> {
		const response = await request(app.getHttpServer())
			.get("/todo-categories")
			.set("Authorization", `Bearer ${accessToken}`)
			.expect(200);

		const categories = response.body.data.items;
		const defaultCategory =
			categories.find((c: { name: string }) => c.name === "할 일") ||
			categories[0];
		return defaultCategory.id;
	}

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

	describe("콕 찌르기 전송", () => {
		const senderEmail = "nudge-sender@example.com";
		const receiverEmail = "nudge-receiver@example.com";
		const password = "Test1234!";

		let sender: { accessToken: string; userId: string; userTag: string };
		let receiver: { accessToken: string; userId: string; userTag: string };
		let receiverTodoId: number;

		beforeAll(async () => {
			sender = await createVerifiedUser(senderEmail, password);
			receiver = await createVerifiedUser(receiverEmail, password);
			await createFriendship(sender, receiver);

			// receiver의 Todo 생성 (nudge 대상)
			const today = new Date().toISOString().split("T")[0];
			const categoryId = await getDefaultCategoryId(receiver.accessToken);
			const todoResponse = await request(app.getHttpServer())
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
				const response = await request(app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: receiver.userId, todoId: receiverTodoId })
					.expect(201);

				expect(response.body.success).toBe(true);
				expect(response.body.data.nudge.id).toBeDefined();
				expect(response.body.data.nudge.senderId).toBe(sender.userId);
				expect(response.body.data.nudge.receiverId).toBe(receiver.userId);
			});

			it("친구가 아닌 사용자에게 콕 찌르기 시 403 에러 반환", async () => {
				// 새 사용자 생성 (친구 아님)
				const stranger = await createVerifiedUser(
					"nudge-stranger@example.com",
					password,
				);

				// stranger의 Todo 생성
				const today = new Date().toISOString().split("T")[0];
				const categoryId = await getDefaultCategoryId(stranger.accessToken);
				const todoResponse = await request(app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${stranger.accessToken}`)
					.send({ title: "Stranger Todo", startDate: today, categoryId });
				const strangerTodoId = todoResponse.body.data?.todo?.id;

				const response = await request(app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: stranger.userId, todoId: strangerTodoId })
					.expect(403);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("NUDGE_1103");
			});

			it("자기 자신에게 콕 찌르기 시 400 에러 반환", async () => {
				// sender의 Todo 생성
				const today = new Date().toISOString().split("T")[0];
				const categoryId = await getDefaultCategoryId(sender.accessToken);
				const todoResponse = await request(app.getHttpServer())
					.post("/todos")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ title: "Self Todo", startDate: today, categoryId });
				const selfTodoId = todoResponse.body.data?.todo?.id;

				const response = await request(app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: sender.userId, todoId: selfTodoId })
					.expect(400);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("NUDGE_1104");
			});

			it("쿨다운 기간 내 동일 Todo에 다시 콕 찌르기 시 429 에러 반환", async () => {
				// 두 번째 콕 찌르기 시도 (쿨다운)
				const response = await request(app.getHttpServer())
					.post("/nudges")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.send({ receiverId: receiver.userId, todoId: receiverTodoId })
					.expect(429);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("NUDGE_1102");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer())
					.post("/nudges")
					.send({ receiverId: receiver.userId, todoId: receiverTodoId })
					.expect(401);
			});
		});
	});

	describe("콕 찌름 목록 조회", () => {
		const senderEmail = "nudge-list-sender@example.com";
		const receiverEmail = "nudge-list-receiver@example.com";
		const password = "Test1234!";

		let sender: { accessToken: string; userId: string; userTag: string };
		let receiver: { accessToken: string; userId: string; userTag: string };

		beforeAll(async () => {
			sender = await createVerifiedUser(senderEmail, password);
			receiver = await createVerifiedUser(receiverEmail, password);
			await createFriendship(sender, receiver);

			// receiver의 Todo 생성
			const today = new Date().toISOString().split("T")[0];
			const categoryId = await getDefaultCategoryId(receiver.accessToken);
			const todoResponse = await request(app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${receiver.accessToken}`)
				.send({ title: "목록 조회 테스트 할일", startDate: today, categoryId });
			const todoId = todoResponse.body.data?.todo?.id;

			// 테스트용 콕 찌르기 생성
			await request(app.getHttpServer())
				.post("/nudges")
				.set("Authorization", `Bearer ${sender.accessToken}`)
				.send({ receiverId: receiver.userId, todoId });
		});

		describe("GET /nudges/received - 받은 콕 찌름 목록", () => {
			it("받은 콕 찌름 목록을 조회한다", async () => {
				const response = await request(app.getHttpServer())
					.get("/nudges/received")
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.nudges).toBeInstanceOf(Array);
				expect(response.body.data.nudges.length).toBeGreaterThanOrEqual(1);
				expect(response.body.data.hasMore).toBeDefined();
			});

			it("limit 파라미터로 조회 개수를 제한한다", async () => {
				const response = await request(app.getHttpServer())
					.get("/nudges/received")
					.query({ limit: 1 })
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.nudges).toBeInstanceOf(Array);
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer()).get("/nudges/received").expect(401);
			});
		});

		describe("GET /nudges/sent - 보낸 콕 찌름 목록", () => {
			it("보낸 콕 찌름 목록을 조회한다", async () => {
				const response = await request(app.getHttpServer())
					.get("/nudges/sent")
					.set("Authorization", `Bearer ${sender.accessToken}`)
					.expect(200);

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

		let user: { accessToken: string; userId: string; userTag: string };
		let friend: { accessToken: string; userId: string; userTag: string };

		beforeAll(async () => {
			user = await createVerifiedUser(userEmail, password);
			friend = await createVerifiedUser(friendEmail, password);
			await createFriendship(user, friend);
		});

		describe("GET /nudges/limit - 일일 제한 정보 조회", () => {
			it("일일 제한 정보를 조회한다", async () => {
				const response = await request(app.getHttpServer())
					.get("/nudges/limit")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.usedToday).toBeDefined();
				expect(response.body.data.remainingToday).toBeDefined();
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer()).get("/nudges/limit").expect(401);
			});
		});

		describe("GET /nudges/cooldown/:userId - 쿨다운 상태 조회", () => {
			it("쿨다운 상태를 조회한다", async () => {
				const response = await request(app.getHttpServer())
					.get(`/nudges/cooldown/${friend.userId}`)
					.set("Authorization", `Bearer ${user.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(typeof response.body.data.canNudge).toBe("boolean");
				expect(
					response.body.data.remainingSeconds === null ||
						typeof response.body.data.remainingSeconds === "number",
				).toBe(true);
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer())
					.get(`/nudges/cooldown/${friend.userId}`)
					.expect(401);
			});
		});
	});

	describe("읽음 처리", () => {
		const senderEmail = "nudge-read-sender@example.com";
		const receiverEmail = "nudge-read-receiver@example.com";
		const password = "Test1234!";

		let sender: { accessToken: string; userId: string; userTag: string };
		let receiver: { accessToken: string; userId: string; userTag: string };
		let nudgeId: number;

		beforeAll(async () => {
			sender = await createVerifiedUser(senderEmail, password);
			receiver = await createVerifiedUser(receiverEmail, password);
			await createFriendship(sender, receiver);

			// receiver의 Todo 생성
			const today = new Date().toISOString().split("T")[0];
			const categoryId = await getDefaultCategoryId(receiver.accessToken);
			const todoResponse = await request(app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${receiver.accessToken}`)
				.send({ title: "읽음 처리 테스트 할일", startDate: today, categoryId });
			const todoId = todoResponse.body.data?.todo?.id;

			// 테스트용 콕 찌르기 생성
			const response = await request(app.getHttpServer())
				.post("/nudges")
				.set("Authorization", `Bearer ${sender.accessToken}`)
				.send({ receiverId: receiver.userId, todoId });

			nudgeId = response.body.data.nudge.id;
		});

		describe("PATCH /nudges/:id/read - 읽음 처리", () => {
			it("받은 콕 찌름을 읽음 처리한다", async () => {
				const response = await request(app.getHttpServer())
					.patch(`/nudges/${nudgeId}/read`)
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.readCount).toBe(1);
			});

			it("존재하지 않는 콕 찌름 읽음 처리 시 404 에러 반환", async () => {
				const response = await request(app.getHttpServer())
					.patch("/nudges/99999/read")
					.set("Authorization", `Bearer ${receiver.accessToken}`)
					.expect(404);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("NUDGE_1105");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer())
					.patch(`/nudges/${nudgeId}/read`)
					.expect(401);
			});
		});
	});
});
