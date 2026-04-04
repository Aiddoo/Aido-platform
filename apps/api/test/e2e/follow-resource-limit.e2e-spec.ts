/**
 * Follow 리소스 제한 E2E 테스트
 *
 * @description
 * Free 유저의 친구 5명 제한 테스트.
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import { FOLLOW_LIMITS } from "@aido/validators";
import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";
import type { VerifiedUser } from "./helpers/e2e-helpers";

const FREE_LIMIT = FOLLOW_LIMITS.FREE_MAX_FRIENDS; // 5

describe("Follow Resource Limit (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	// ============================================
	// Free 유저 친구 제한
	// ============================================

	describe("Free 유저 친구 제한", () => {
		let freeUser: VerifiedUser;
		const friends: VerifiedUser[] = [];

		beforeAll(async () => {
			// 테스트 유저(Free) 생성
			freeUser = await ctx.helpers.createVerifiedUser(
				"follow-limit-free@example.com",
				"Test1234!",
			);

			// FREE_LIMIT + 1명의 친구 후보 생성
			for (let i = 0; i < FREE_LIMIT + 1; i++) {
				const friend = await ctx.helpers.createVerifiedUser(
					`follow-friend-${i}@example.com`,
					"Test1234!",
				);
				friends.push(friend);
			}

			// FREE_LIMIT명과 친구 관계 성립
			for (const friend of friends.slice(0, FREE_LIMIT)) {
				await ctx.helpers.createFriendship(freeUser, friend);
			}
		});

		it(`친구 ${FREE_LIMIT}명 도달 후 추가 요청 시 403 에러`, async () => {
			// Given - FREE_LIMIT명과 이미 친구 관계가 성립된 상태
			const extraFriend = friends[FREE_LIMIT];
			expect(extraFriend).toBeDefined();

			// When - FREE_LIMIT + 1번째 친구 요청
			const response = await request(ctx.app.getHttpServer())
				.post(`/follows/${extraFriend?.userTag}`)
				.set("Authorization", `Bearer ${freeUser.accessToken}`)
				.expect(403);

			// Then - 403 에러와 FOLLOW_0909 코드 반환
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("FOLLOW_0909");
		});

		it("GET /follows/resource-limit - 현재 친구 수와 한도 조회", async () => {
			// Given - FREE_LIMIT명과 친구 관계가 성립된 Free 유저

			// When - 리소스 제한 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/follows/resource-limit")
				.set("Authorization", `Bearer ${freeUser.accessToken}`)
				.expect(200);

			// Then - 현재 친구 수와 한도가 FREE_LIMIT과 일치
			expect(response.body.data.friendCount).toBe(FREE_LIMIT);
			expect(response.body.data.maxCount).toBe(FREE_LIMIT);
		});
	});

	// ============================================
	// Premium 유저 무제한
	// ============================================

	describe("Premium 유저 무제한", () => {
		let premiumUser: VerifiedUser;
		const friends: VerifiedUser[] = [];

		beforeAll(async () => {
			// 프리미엄 유저 생성
			premiumUser = await ctx.helpers.createVerifiedUser(
				"follow-limit-premium@example.com",
				"Test1234!",
			);

			// 구독 상태를 ACTIVE로 변경
			const prisma = ctx.testDatabase.getPrisma();
			await prisma.user.update({
				where: { id: premiumUser.userId },
				data: { subscriptionStatus: "ACTIVE" },
			});

			// FREE_LIMIT + 1명의 친구 후보 생성
			for (let i = 0; i < FREE_LIMIT + 1; i++) {
				const friend = await ctx.helpers.createVerifiedUser(
					`follow-premium-friend-${i}@example.com`,
					"Test1234!",
				);
				friends.push(friend);
			}

			// FREE_LIMIT명과 친구 관계 성립
			for (const friend of friends.slice(0, FREE_LIMIT)) {
				await ctx.helpers.createFriendship(premiumUser, friend);
			}
		});

		it("Free 한도 초과해도 친구 요청 성공", async () => {
			// Given - FREE_LIMIT명과 이미 친구 관계가 성립된 Premium 유저
			const extraFriend = friends[FREE_LIMIT];
			expect(extraFriend).toBeDefined();

			// When - FREE_LIMIT + 1번째 친구 요청
			const response = await request(ctx.app.getHttpServer())
				.post(`/follows/${extraFriend?.userTag}`)
				.set("Authorization", `Bearer ${premiumUser.accessToken}`)
				.expect(201);

			// Then - 친구 요청 성공
			expect(response.body.data.autoAccepted).toBe(false);
		});

		it("GET /follows/resource-limit - maxCount가 null (무제한)", async () => {
			// Given - Premium 유저

			// When - 리소스 제한 조회
			const response = await request(ctx.app.getHttpServer())
				.get("/follows/resource-limit")
				.set("Authorization", `Bearer ${premiumUser.accessToken}`)
				.expect(200);

			// Then - maxCount가 null (무제한)이고 친구 수는 FREE_LIMIT
			expect(response.body.data.maxCount).toBeNull();
			expect(response.body.data.friendCount).toBe(FREE_LIMIT);
		});
	});
});
