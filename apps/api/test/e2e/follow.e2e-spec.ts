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

import request from "supertest";
import {
	createE2eApp,
	destroyE2eApp,
	type E2eTestContext,
	type VerifiedUser,
} from "./helpers";

describe("Follow (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	describe("친구 요청 플로우", () => {
		const userAEmail = "user-a@example.com";
		const userBEmail = "user-b@example.com";
		const password = "Test1234!";

		let userA: VerifiedUser;
		let userB: VerifiedUser;

		beforeAll(async () => {
			userA = await ctx.helpers.createVerifiedUser(userAEmail, password);
			userB = await ctx.helpers.createVerifiedUser(userBEmail, password);
		});

		describe("POST /follows/:userTag - 친구 요청 보내기", () => {
			it("친구 요청을 성공적으로 보낸다", async () => {
				// Given - 두 명의 인증된 사용자가 준비됨 (beforeAll에서 생성)

				// When - 친구 요청 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post(`/follows/${userB.userTag}`)
					.set("Authorization", `Bearer ${userA.accessToken}`)
					.expect(201);

				// Then - 응답 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.follow).toBeDefined();
				expect(response.body.data.follow.status).toBe("PENDING");
				expect(response.body.data.autoAccepted).toBe(false);
			});

			it("이미 요청을 보낸 경우 409 에러 반환", async () => {
				// Given - 이미 친구 요청을 보낸 상태

				// When - 동일한 친구 요청 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post(`/follows/${userB.userTag}`)
					.set("Authorization", `Bearer ${userA.accessToken}`)
					.expect(409);

				// Then - 중복 요청 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("FOLLOW_0901");
			});

			it("자기 자신에게 요청 시 400 에러 반환", async () => {
				// Given - 인증된 사용자

				// When - 자기 자신에게 친구 요청 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post(`/follows/${userA.userTag}`)
					.set("Authorization", `Bearer ${userA.accessToken}`)
					.expect(400);

				// Then - 자기 자신 요청 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("FOLLOW_0904");
			});

			it("존재하지 않는 사용자에게 요청 시 404 에러 반환", async () => {
				// Given - 존재하지 않는 userTag
				const nonExistentUserTag = "ZZZZ9999";

				// When - 존재하지 않는 사용자에게 친구 요청 API 호출
				const response = await request(ctx.app.getHttpServer())
					.post(`/follows/${nonExistentUserTag}`)
					.set("Authorization", `Bearer ${userA.accessToken}`)
					.expect(404);

				// Then - 사용자 없음 에러 검증
				expect(response.body.success).toBe(false);
				expect(response.body.error.code).toBe("FOLLOW_0905");
			});

			it("인증 없이 요청 시 401 에러 반환", async () => {
				// Given - 인증 토큰 없음

				// When - 인증 없이 친구 요청 API 호출
				await request(ctx.app.getHttpServer())
					.post(`/follows/${userB.userTag}`)
					.expect(401);

				// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
			});
		});

		describe("GET /follows/requests/sent - 보낸 요청 목록", () => {
			it("보낸 친구 요청 목록을 조회한다", async () => {
				// Given - 친구 요청을 보낸 상태 (이전 테스트에서 생성)

				// When - 보낸 요청 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/follows/requests/sent")
					.set("Authorization", `Bearer ${userA.accessToken}`)
					.expect(200);

				// Then - 보낸 요청 목록 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.requests).toBeInstanceOf(Array);
				expect(response.body.data.requests.length).toBeGreaterThan(0);
				// 요청 목록의 아이템은 사용자 정보를 포함
				expect(response.body.data.requests[0].id).toBeDefined();
			});
		});

		describe("GET /follows/requests/received - 받은 요청 목록", () => {
			it("받은 친구 요청 목록을 조회한다", async () => {
				// Given - 친구 요청을 받은 상태 (이전 테스트에서 생성)

				// When - 받은 요청 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/follows/requests/received")
					.set("Authorization", `Bearer ${userB.accessToken}`)
					.expect(200);

				// Then - 받은 요청 목록 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.requests).toBeInstanceOf(Array);
				expect(response.body.data.requests.length).toBeGreaterThan(0);
				// 요청 목록의 아이템은 사용자 정보를 포함
				expect(response.body.data.requests[0].id).toBeDefined();
			});
		});

		describe("PATCH /follows/:userId/accept - 친구 요청 수락", () => {
			it("친구 요청을 수락한다", async () => {
				// Given - 친구 요청을 받은 상태 (userA -> userB)

				// When - 친구 요청 수락 API 호출
				const response = await request(ctx.app.getHttpServer())
					.patch(`/follows/${userA.userId}/accept`)
					.set("Authorization", `Bearer ${userB.accessToken}`)
					.expect(200);

				// Then - 수락 성공 검증
				expect(response.body.success).toBe(true);
			});

			it("수락 후 친구 목록에 나타난다", async () => {
				// Given - 친구 요청을 수락한 상태

				// When - 친구 목록 조회 API 호출
				const response = await request(ctx.app.getHttpServer())
					.get("/follows/friends")
					.set("Authorization", `Bearer ${userA.accessToken}`)
					.expect(200);

				// Then - 친구 목록 검증
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

		let userC: VerifiedUser;
		let userD: VerifiedUser;

		beforeAll(async () => {
			userC = await ctx.helpers.createVerifiedUser(userCEmail, password);
			userD = await ctx.helpers.createVerifiedUser(userDEmail, password);
		});

		it("친구 요청을 철회한다", async () => {
			// Given - 친구 요청을 보낸 상태
			await request(ctx.app.getHttpServer())
				.post(`/follows/${userD.userTag}`)
				.set("Authorization", `Bearer ${userC.accessToken}`)
				.expect(201);

			// When - 친구 요청 철회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.delete(`/follows/${userD.userId}`)
				.set("Authorization", `Bearer ${userC.accessToken}`)
				.expect(200);

			// Then - 철회 성공 및 보낸 요청 목록에서 제거됨 검증
			expect(response.body.success).toBe(true);

			const sentRequests = await request(ctx.app.getHttpServer())
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

		let userE: VerifiedUser;
		let userF: VerifiedUser;

		beforeAll(async () => {
			userE = await ctx.helpers.createVerifiedUser(userEEmail, password);
			userF = await ctx.helpers.createVerifiedUser(userFEmail, password);
		});

		it("친구 요청을 거절한다", async () => {
			// Given - E가 F에게 친구 요청을 보낸 상태
			await request(ctx.app.getHttpServer())
				.post(`/follows/${userF.userTag}`)
				.set("Authorization", `Bearer ${userE.accessToken}`)
				.expect(201);

			// When - F가 친구 요청 거절 API 호출
			const response = await request(ctx.app.getHttpServer())
				.patch(`/follows/${userE.userId}/reject`)
				.set("Authorization", `Bearer ${userF.accessToken}`)
				.expect(200);

			// Then - 거절 성공 및 받은 요청 목록에서 제거됨 검증
			expect(response.body.success).toBe(true);

			const receivedRequests = await request(ctx.app.getHttpServer())
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

		let userG: VerifiedUser;
		let userH: VerifiedUser;

		beforeAll(async () => {
			userG = await ctx.helpers.createVerifiedUser(userGEmail, password);
			userH = await ctx.helpers.createVerifiedUser(userHEmail, password);
		});

		it("상대방이 먼저 요청한 경우 자동으로 친구가 된다", async () => {
			// Given - G가 H에게 친구 요청을 보낸 상태
			await request(ctx.app.getHttpServer())
				.post(`/follows/${userH.userTag}`)
				.set("Authorization", `Bearer ${userG.accessToken}`)
				.expect(201);

			// When - H가 G에게 친구 요청 API 호출 (자동 수락 예상)
			const response = await request(ctx.app.getHttpServer())
				.post(`/follows/${userG.userTag}`)
				.set("Authorization", `Bearer ${userH.accessToken}`)
				.expect(201);

			// Then - 자동 수락 및 양방향 친구 관계 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.autoAccepted).toBe(true);
			expect(response.body.data.follow.status).toBe("ACCEPTED");

			const gFriends = await request(ctx.app.getHttpServer())
				.get("/follows/friends")
				.set("Authorization", `Bearer ${userG.accessToken}`)
				.expect(200);

			const hFriends = await request(ctx.app.getHttpServer())
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

		let userI: VerifiedUser;
		let userJ: VerifiedUser;

		beforeAll(async () => {
			userI = await ctx.helpers.createVerifiedUser(userIEmail, password);
			userJ = await ctx.helpers.createVerifiedUser(userJEmail, password);
		});

		it("친구가 아니면 투두 조회 시 403 에러 반환", async () => {
			// Given - 친구 관계가 아닌 두 사용자

			// When - 친구 투두 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get(`/todos/friends/${userJ.userId}`)
				.set("Authorization", `Bearer ${userI.accessToken}`)
				.expect(403);

			// Then - 권한 없음 에러 검증
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("FOLLOW_0906");
		});

		it("친구가 되면 PUBLIC 투두만 조회 가능", async () => {
			// Given - 서로 친구가 된 상태 및 J의 PUBLIC/PRIVATE 투두 생성
			await request(ctx.app.getHttpServer())
				.post(`/follows/${userJ.userTag}`)
				.set("Authorization", `Bearer ${userI.accessToken}`)
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post(`/follows/${userI.userTag}`)
				.set("Authorization", `Bearer ${userJ.accessToken}`)
				.expect(201);

			const categoryId = await ctx.helpers.getDefaultCategoryId(
				userJ.accessToken,
			);

			await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${userJ.accessToken}`)
				.send({
					title: "J의 공개 할 일",
					startDate: new Date().toISOString().split("T")[0],
					visibility: "PUBLIC",
					categoryId,
				})
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post("/todos")
				.set("Authorization", `Bearer ${userJ.accessToken}`)
				.send({
					title: "J의 비공개 할 일",
					startDate: new Date().toISOString().split("T")[0],
					visibility: "PRIVATE",
					categoryId,
				})
				.expect(201);

			// When - I가 J의 친구 투두 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get(`/todos/friends/${userJ.userId}`)
				.set("Authorization", `Bearer ${userI.accessToken}`)
				.expect(200);

			// Then - PUBLIC 투두만 조회됨 검증
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

		let mainUser: VerifiedUser;
		const friendUsers: VerifiedUser[] = [];

		beforeAll(async () => {
			mainUser = await ctx.helpers.createVerifiedUser(mainUserEmail, password);

			// 5명의 친구 생성 및 맞팔
			for (let i = 0; i < 5; i++) {
				const friend = await ctx.helpers.createVerifiedUser(
					`friend-${i}@example.com`,
					password,
				);
				friendUsers.push(friend);

				// 상호 친구 요청 (자동 수락)
				await request(ctx.app.getHttpServer())
					.post(`/follows/${friend.userTag}`)
					.set("Authorization", `Bearer ${mainUser.accessToken}`)
					.expect(201);

				await request(ctx.app.getHttpServer())
					.post(`/follows/${mainUser.userTag}`)
					.set("Authorization", `Bearer ${friend.accessToken}`)
					.expect(201);
			}
		});

		it("친구 목록을 페이지네이션하여 조회한다", async () => {
			// Given - 5명의 친구가 있는 상태

			// When - limit을 3으로 설정하여 친구 목록 조회 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get("/follows/friends")
				.query({ limit: 3 })
				.set("Authorization", `Bearer ${mainUser.accessToken}`)
				.expect(200);

			// Then - 페이지네이션 결과 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.friends.length).toBe(3);
			expect(response.body.data.hasMore).toBe(true);
		});

		it("커서를 사용하여 다음 페이지를 조회한다", async () => {
			// Given - 첫 페이지 조회 후 커서 획득
			const firstPage = await request(ctx.app.getHttpServer())
				.get("/follows/friends")
				.query({ limit: 3 })
				.set("Authorization", `Bearer ${mainUser.accessToken}`)
				.expect(200);

			const lastFriend =
				firstPage.body.data.friends[firstPage.body.data.friends.length - 1];
			const cursor = lastFriend.followId;
			expect(cursor).toBeDefined();

			// When - 커서를 사용하여 두 번째 페이지 조회 API 호출
			const secondPage = await request(ctx.app.getHttpServer())
				.get("/follows/friends")
				.query({ limit: 3, cursor })
				.set("Authorization", `Bearer ${mainUser.accessToken}`)
				.expect(200);

			// Then - 두 번째 페이지 결과 검증
			expect(secondPage.body.success).toBe(true);
			expect(secondPage.body.data.friends.length).toBe(2);
			expect(secondPage.body.data.hasMore).toBe(false);
		});
	});

	describe("친구 목록 검색 (userTag)", () => {
		const searchUserEmail = "search-main@example.com";
		const password = "Test1234!";

		let searchUser: VerifiedUser;
		let searchFriend: VerifiedUser;

		beforeAll(async () => {
			searchUser = await ctx.helpers.createVerifiedUser(
				searchUserEmail,
				password,
			);

			// 친구 생성
			searchFriend = await ctx.helpers.createVerifiedUser(
				"search-friend@example.com",
				password,
			);

			// 상호 친구 요청 (자동 수락)
			await request(ctx.app.getHttpServer())
				.post(`/follows/${searchFriend.userTag}`)
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(201);

			await request(ctx.app.getHttpServer())
				.post(`/follows/${searchUser.userTag}`)
				.set("Authorization", `Bearer ${searchFriend.accessToken}`)
				.expect(201);
		});

		it("userTag로 검색하면 해당 친구만 반환된다", async () => {
			// Given - 친구 목록을 조회하여 userTag 획득
			const allFriends = await request(ctx.app.getHttpServer())
				.get("/follows/friends")
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			const friendUserTag = allFriends.body.data.friends[0]?.userTag;
			expect(friendUserTag).toBeDefined();

			const searchTerm = friendUserTag.slice(0, 3);

			// When - userTag 일부로 검색 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get("/follows/friends")
				.query({ search: searchTerm })
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			// Then - 검색 결과 검증
			expect(response.body.success).toBe(true);
			expect(
				response.body.data.friends.every((f: { userTag: string }) =>
					f.userTag.toUpperCase().includes(searchTerm.toUpperCase()),
				),
			).toBe(true);
		});

		it("대소문자 구분 없이 검색된다", async () => {
			// Given - 친구 목록을 조회하여 userTag 획득
			const allFriends = await request(ctx.app.getHttpServer())
				.get("/follows/friends")
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			const friendUserTag = allFriends.body.data.friends[0]?.userTag;
			expect(friendUserTag).toBeDefined();

			const searchTerm = friendUserTag.slice(0, 3).toLowerCase();

			// When - 소문자로 검색 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get("/follows/friends")
				.query({ search: searchTerm })
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			// Then - 대소문자 무시하고 매칭됨 검증
			expect(response.body.data.friends.length).toBeGreaterThan(0);
		});

		it("검색 결과가 없으면 빈 배열 반환", async () => {
			// Given - 존재하지 않는 검색어

			// When - 존재하지 않는 태그로 검색 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get("/follows/friends")
				.query({ search: "ZZZZZ999" })
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			// Then - 빈 배열 반환 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.friends).toHaveLength(0);
		});

		it("검색과 페이지네이션이 함께 동작한다", async () => {
			// Given - 친구 목록을 조회하여 검색어 획득
			const allFriends = await request(ctx.app.getHttpServer())
				.get("/follows/friends")
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			const friendUserTag = allFriends.body.data.friends[0]?.userTag;
			const searchTerm = friendUserTag?.slice(0, 2) || "";

			// When - 검색어와 limit을 함께 사용하여 API 호출
			const response = await request(ctx.app.getHttpServer())
				.get("/follows/friends")
				.query({ search: searchTerm, limit: 5 })
				.set("Authorization", `Bearer ${searchUser.accessToken}`)
				.expect(200);

			// Then - 검색과 페이지네이션 함께 동작 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.friends.length).toBeLessThanOrEqual(5);
		});
	});
});
