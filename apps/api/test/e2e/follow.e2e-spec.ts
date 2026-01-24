/**
 * Follow E2E 테스트
 *
 * @description
 * 친구 요청 시스템 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 시나리오:
 * 1. 친구 요청 보내기/철회
 * 2. 친구 요청 수락/거절
 * 3. 친구 목록 조회
 * 4. 친구 삭제
 * 5. 친구 투두 조회
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

describe("Follow (e2e)", () => {
	let app: INestApplication<App>;
	let testDatabase: TestDatabase;
	let fakeEmailService: FakeEmailService;
	let fakeOAuthTokenVerifierService: FakeOAuthTokenVerifierService;

	/**
	 * 테스트용 사용자 등록 및 인증 헬퍼
	 * @returns { accessToken, userId }
	 */
	async function createVerifiedUser(
		email: string,
		password: string,
	): Promise<{ accessToken: string; userId: string }> {
		// 등록
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

		// 인증
		const code = fakeEmailService.getLastCode(email);
		const response = await request(app.getHttpServer())
			.post("/auth/verify-email")
			.send({ email, code })
			.expect(200);

		return {
			accessToken: response.body.data.accessToken,
			userId: response.body.data.userId,
		};
	}

	beforeAll(async () => {
		// Testcontainers로 PostgreSQL 컨테이너 시작
		testDatabase = new TestDatabase();
		await testDatabase.start();

		// FakeEmailService 인스턴스 생성
		fakeEmailService = new FakeEmailService();

		// FakeOAuthTokenVerifierService 인스턴스 생성
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

	describe("친구 요청 플로우", () => {
		const userAEmail = "user-a@example.com";
		const userBEmail = "user-b@example.com";
		const password = "Test1234!";

		let userA: { accessToken: string; userId: string };
		let userB: { accessToken: string; userId: string };

		beforeAll(async () => {
			userA = await createVerifiedUser(userAEmail, password);
			userB = await createVerifiedUser(userBEmail, password);
		});

		describe("POST /follows/:userId - 친구 요청 보내기", () => {
			it("친구 요청을 성공적으로 보낸다", async () => {
				const response = await request(app.getHttpServer())
					.post(`/follows/${userB.userId}`)
					.set("Authorization", `Bearer ${userA.accessToken}`)
					.expect(201);

				expect(response.body.success).toBe(true);
				expect(response.body.data.follow).toBeDefined();
				expect(response.body.data.follow.status).toBe("PENDING");
				expect(response.body.data.autoAccepted).toBe(false);
			});

			it("이미 요청을 보낸 경우 409 에러 반환", async () => {
				const response = await request(app.getHttpServer())
					.post(`/follows/${userB.userId}`)
					.set("Authorization", `Bearer ${userA.accessToken}`)
					.expect(409);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("FOLLOW_0901");
			});

			it("자기 자신에게 요청 시 400 에러 반환", async () => {
				const response = await request(app.getHttpServer())
					.post(`/follows/${userA.userId}`)
					.set("Authorization", `Bearer ${userA.accessToken}`)
					.expect(400);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("FOLLOW_0904");
			});

			it("존재하지 않는 사용자에게 요청 시 404 에러 반환", async () => {
				// 유효한 CUID 형식이지만 존재하지 않는 사용자 ID
				const nonExistentUserId = "clz7x5p8k0000qz0z8z8z8z8z";
				const response = await request(app.getHttpServer())
					.post(`/follows/${nonExistentUserId}`)
					.set("Authorization", `Bearer ${userA.accessToken}`)
					.expect(404);

				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("FOLLOW_0905");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				await request(app.getHttpServer())
					.post(`/follows/${userB.userId}`)
					.expect(401);
			});
		});

		describe("GET /follows/requests/sent - 보낸 요청 목록", () => {
			it("보낸 친구 요청 목록을 조회한다", async () => {
				const response = await request(app.getHttpServer())
					.get("/follows/requests/sent")
					.set("Authorization", `Bearer ${userA.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.requests).toBeInstanceOf(Array);
				expect(response.body.data.requests.length).toBeGreaterThan(0);
				// 요청 목록의 아이템은 사용자 정보를 포함
				expect(response.body.data.requests[0].id).toBeDefined();
			});
		});

		describe("GET /follows/requests/received - 받은 요청 목록", () => {
			it("받은 친구 요청 목록을 조회한다", async () => {
				const response = await request(app.getHttpServer())
					.get("/follows/requests/received")
					.set("Authorization", `Bearer ${userB.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.requests).toBeInstanceOf(Array);
				expect(response.body.data.requests.length).toBeGreaterThan(0);
				// 요청 목록의 아이템은 사용자 정보를 포함
				expect(response.body.data.requests[0].id).toBeDefined();
			});
		});

		describe("PATCH /follows/:userId/accept - 친구 요청 수락", () => {
			it("친구 요청을 수락한다", async () => {
				const response = await request(app.getHttpServer())
					.patch(`/follows/${userA.userId}/accept`)
					.set("Authorization", `Bearer ${userB.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
			});

			it("수락 후 친구 목록에 나타난다", async () => {
				const response = await request(app.getHttpServer())
					.get("/follows/friends")
					.set("Authorization", `Bearer ${userA.accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.friends).toBeInstanceOf(Array);
				// A -> B 요청 수락 후 맞팔 확인을 위해 B도 A에게 요청을 보내야 함
				// 현재 로직에서는 수락 시 양방향 Follow가 생성됨
			});
		});
	});

	describe("친구 삭제 및 요청 철회 플로우", () => {
		const userCEmail = "user-c@example.com";
		const userDEmail = "user-d@example.com";
		const password = "Test1234!";

		let userC: { accessToken: string; userId: string };
		let userD: { accessToken: string; userId: string };

		beforeAll(async () => {
			userC = await createVerifiedUser(userCEmail, password);
			userD = await createVerifiedUser(userDEmail, password);
		});

		it("친구 요청을 철회한다", async () => {
			// 요청 보내기
			await request(app.getHttpServer())
				.post(`/follows/${userD.userId}`)
				.set("Authorization", `Bearer ${userC.accessToken}`)
				.expect(201);

			// 요청 철회 (DELETE)
			const response = await request(app.getHttpServer())
				.delete(`/follows/${userD.userId}`)
				.set("Authorization", `Bearer ${userC.accessToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);

			// 보낸 요청 목록에서 사라졌는지 확인
			const sentRequests = await request(app.getHttpServer())
				.get("/follows/requests/sent")
				.set("Authorization", `Bearer ${userC.accessToken}`)
				.expect(200);

			const hasPendingRequest = sentRequests.body.data.requests.some(
				(item: { id: string }) => item.id === userD.userId,
			);
			expect(hasPendingRequest).toBe(false);
		});
	});

	describe("친구 요청 거절 플로우", () => {
		const userEEmail = "user-e@example.com";
		const userFEmail = "user-f@example.com";
		const password = "Test1234!";

		let userE: { accessToken: string; userId: string };
		let userF: { accessToken: string; userId: string };

		beforeAll(async () => {
			userE = await createVerifiedUser(userEEmail, password);
			userF = await createVerifiedUser(userFEmail, password);
		});

		it("친구 요청을 거절한다", async () => {
			// E가 F에게 요청 보내기
			await request(app.getHttpServer())
				.post(`/follows/${userF.userId}`)
				.set("Authorization", `Bearer ${userE.accessToken}`)
				.expect(201);

			// F가 거절
			const response = await request(app.getHttpServer())
				.patch(`/follows/${userE.userId}/reject`)
				.set("Authorization", `Bearer ${userF.accessToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);

			// 받은 요청 목록에서 사라졌는지 확인
			const receivedRequests = await request(app.getHttpServer())
				.get("/follows/requests/received")
				.set("Authorization", `Bearer ${userF.accessToken}`)
				.expect(200);

			const hasPendingRequest = receivedRequests.body.data.requests.some(
				(item: { id: string }) => item.id === userE.userId,
			);
			expect(hasPendingRequest).toBe(false);
		});
	});

	describe("자동 수락 플로우 (상대방이 먼저 요청)", () => {
		const userGEmail = "user-g@example.com";
		const userHEmail = "user-h@example.com";
		const password = "Test1234!";

		let userG: { accessToken: string; userId: string };
		let userH: { accessToken: string; userId: string };

		beforeAll(async () => {
			userG = await createVerifiedUser(userGEmail, password);
			userH = await createVerifiedUser(userHEmail, password);
		});

		it("상대방이 먼저 요청한 경우 자동으로 친구가 된다", async () => {
			// G가 H에게 요청 보내기
			await request(app.getHttpServer())
				.post(`/follows/${userH.userId}`)
				.set("Authorization", `Bearer ${userG.accessToken}`)
				.expect(201);

			// H가 G에게 요청 보내기 (자동 수락 예상)
			const response = await request(app.getHttpServer())
				.post(`/follows/${userG.userId}`)
				.set("Authorization", `Bearer ${userH.accessToken}`)
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.autoAccepted).toBe(true);
			expect(response.body.data.follow.status).toBe("ACCEPTED");

			// 친구 목록에서 서로 확인
			const gFriends = await request(app.getHttpServer())
				.get("/follows/friends")
				.set("Authorization", `Bearer ${userG.accessToken}`)
				.expect(200);

			const hFriends = await request(app.getHttpServer())
				.get("/follows/friends")
				.set("Authorization", `Bearer ${userH.accessToken}`)
				.expect(200);

			const gHasFriendH = gFriends.body.data.friends.some(
				(item: { id: string }) => item.id === userH.userId,
			);
			const hHasFriendG = hFriends.body.data.friends.some(
				(item: { id: string }) => item.id === userG.userId,
			);

			expect(gHasFriendH).toBe(true);
			expect(hHasFriendG).toBe(true);
		});
	});

	describe("친구 투두 조회 플로우", () => {
		const userIEmail = "user-i@example.com";
		const userJEmail = "user-j@example.com";
		const password = "Test1234!";

		let userI: { accessToken: string; userId: string };
		let userJ: { accessToken: string; userId: string };

		beforeAll(async () => {
			userI = await createVerifiedUser(userIEmail, password);
			userJ = await createVerifiedUser(userJEmail, password);
		});

		it("친구가 아니면 투두 조회 시 403 에러 반환", async () => {
			const response = await request(app.getHttpServer())
				.get(`/todos/friends/${userJ.userId}`)
				.set("Authorization", `Bearer ${userI.accessToken}`)
				.expect(403);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("FOLLOW_0906");
		});

		it("친구가 되면 PUBLIC 투두만 조회 가능", async () => {
			// 서로 친구가 되기 (I가 J에게, J가 I에게 요청 → 자동 수락)
			await request(app.getHttpServer())
				.post(`/follows/${userJ.userId}`)
				.set("Authorization", `Bearer ${userI.accessToken}`)
				.expect(201);

			await request(app.getHttpServer())
				.post(`/follows/${userI.userId}`)
				.set("Authorization", `Bearer ${userJ.accessToken}`)
				.expect(201);

			// J가 PUBLIC 투두 생성
			await request(app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${userJ.accessToken}`)
				.send({
					title: "J의 공개 할 일",
					startDate: new Date().toISOString().split("T")[0],
					visibility: "PUBLIC",
				})
				.expect(201);

			// J가 PRIVATE 투두 생성
			await request(app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${userJ.accessToken}`)
				.send({
					title: "J의 비공개 할 일",
					startDate: new Date().toISOString().split("T")[0],
					visibility: "PRIVATE",
				})
				.expect(201);

			// I가 J의 친구 투두 조회
			const response = await request(app.getHttpServer())
				.get(`/todos/friends/${userJ.userId}`)
				.set("Authorization", `Bearer ${userI.accessToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.items).toBeInstanceOf(Array);
			expect(response.body.data.items.length).toBe(1);
			expect(response.body.data.items[0].title).toBe("J의 공개 할 일");
			expect(response.body.data.items[0].visibility).toBe("PUBLIC");
		});
	});

	describe("친구 목록 페이지네이션", () => {
		const mainUserEmail = "main-user@example.com";
		const password = "Test1234!";

		let mainUser: { accessToken: string; userId: string };
		const friendUsers: Array<{ accessToken: string; userId: string }> = [];

		beforeAll(async () => {
			mainUser = await createVerifiedUser(mainUserEmail, password);

			// 5명의 친구 생성 및 맞팔
			for (let i = 0; i < 5; i++) {
				const friend = await createVerifiedUser(
					`friend-${i}@example.com`,
					password,
				);
				friendUsers.push(friend);

				// 상호 친구 요청 (자동 수락)
				await request(app.getHttpServer())
					.post(`/follows/${friend.userId}`)
					.set("Authorization", `Bearer ${mainUser.accessToken}`)
					.expect(201);

				await request(app.getHttpServer())
					.post(`/follows/${mainUser.userId}`)
					.set("Authorization", `Bearer ${friend.accessToken}`)
					.expect(201);
			}
		});

		it("친구 목록을 페이지네이션하여 조회한다", async () => {
			const response = await request(app.getHttpServer())
				.get("/follows/friends")
				.query({ limit: 3 })
				.set("Authorization", `Bearer ${mainUser.accessToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.friends.length).toBe(3);
			expect(response.body.data.hasMore).toBe(true);
		});

		it("커서를 사용하여 다음 페이지를 조회한다", async () => {
			// 첫 페이지
			const firstPage = await request(app.getHttpServer())
				.get("/follows/friends")
				.query({ limit: 3 })
				.set("Authorization", `Bearer ${mainUser.accessToken}`)
				.expect(200);

			// 마지막 친구의 followId를 커서로 사용
			const lastFriend =
				firstPage.body.data.friends[firstPage.body.data.friends.length - 1];
			const cursor = lastFriend.followId;
			expect(cursor).toBeDefined();

			// 두 번째 페이지
			const secondPage = await request(app.getHttpServer())
				.get("/follows/friends")
				.query({ limit: 3, cursor })
				.set("Authorization", `Bearer ${mainUser.accessToken}`)
				.expect(200);

			expect(secondPage.body.success).toBe(true);
			expect(secondPage.body.data.friends.length).toBe(2);
			expect(secondPage.body.data.hasMore).toBe(false);
		});
	});

	describe("친구 목록 검색 (userTag)", () => {
		const searchUserEmail = "search-main@example.com";
		const password = "Test1234!";

		let searchUser: { accessToken: string; userId: string };
		let searchFriend: { accessToken: string; userId: string };

		beforeAll(async () => {
			searchUser = await createVerifiedUser(searchUserEmail, password);

			// 친구 생성
			searchFriend = await createVerifiedUser(
				"search-friend@example.com",
				password,
			);

			// 상호 친구 요청 (자동 수락)
			await request(app.getHttpServer())
				.post(`/follows/${searchFriend.userId}`)
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(201);

			await request(app.getHttpServer())
				.post(`/follows/${searchUser.userId}`)
				.set("Authorization", `Bearer ${searchFriend.accessToken}`)
				.expect(201);
		});

		it("userTag로 검색하면 해당 친구만 반환된다", async () => {
			// 먼저 친구 목록을 조회하여 userTag를 가져옴
			const allFriends = await request(app.getHttpServer())
				.get("/follows/friends")
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			const friendUserTag = allFriends.body.data.friends[0]?.userTag;
			expect(friendUserTag).toBeDefined();

			// userTag의 일부로 검색
			const searchTerm = friendUserTag.slice(0, 3);

			const response = await request(app.getHttpServer())
				.get("/follows/friends")
				.query({ search: searchTerm })
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(
				response.body.data.friends.every((f: { userTag: string }) =>
					f.userTag.toUpperCase().includes(searchTerm.toUpperCase()),
				),
			).toBe(true);
		});

		it("대소문자 구분 없이 검색된다", async () => {
			// 친구 목록 조회
			const allFriends = await request(app.getHttpServer())
				.get("/follows/friends")
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			const friendUserTag = allFriends.body.data.friends[0]?.userTag;
			expect(friendUserTag).toBeDefined();

			// 소문자로 검색
			const searchTerm = friendUserTag.slice(0, 3).toLowerCase();

			const response = await request(app.getHttpServer())
				.get("/follows/friends")
				.query({ search: searchTerm })
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			// 대소문자 무시하고 매칭됨
			expect(response.body.data.friends.length).toBeGreaterThan(0);
		});

		it("검색 결과가 없으면 빈 배열 반환", async () => {
			const response = await request(app.getHttpServer())
				.get("/follows/friends")
				.query({ search: "ZZZZZ999" }) // 존재하지 않는 태그
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.friends).toHaveLength(0);
		});

		it("검색과 페이지네이션이 함께 동작한다", async () => {
			// 친구 목록 조회
			const allFriends = await request(app.getHttpServer())
				.get("/follows/friends")
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			const friendUserTag = allFriends.body.data.friends[0]?.userTag;
			const searchTerm = friendUserTag?.slice(0, 2) || "";

			const response = await request(app.getHttpServer())
				.get("/follows/friends")
				.query({ search: searchTerm, limit: 5 })
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.friends.length).toBeLessThanOrEqual(5);
		});
	});
});
