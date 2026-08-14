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

describe("팔로우 리소스 제한 E2E", () => {
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

	describe("Free 유저 친구 제한", () => {
		it(`친구 ${FREE_LIMIT}명 도달 후 추가 요청 시 403 에러, 리소스 제한 조회 확인`, async () => {
			// Given - Free 유저와 FREE_LIMIT + 1명의 친구 후보 생성
			const freeUser = await ctx.helpers.createVerifiedUser("follow-limit-free@test.com", password);
			const friends: VerifiedUser[] = [];

			for (let i = 0; i < FREE_LIMIT + 1; i++) {
				const friend = await ctx.helpers.createVerifiedUser(
					`follow-friend-${i}@test.com`,
					password,
				);
				friends.push(friend);
			}

			// FREE_LIMIT명과 친구 관계 성립
			for (const friend of friends.slice(0, FREE_LIMIT)) {
				await ctx.helpers.createFriendship(freeUser, friend);
			}

			// When - FREE_LIMIT + 1번째 친구 요청
			const extraFriend = friends[FREE_LIMIT];
			expect(extraFriend).toBeDefined();

			const response = await request(ctx.app.getHttpServer())
				.post(`/v1/follows/${extraFriend?.userTag}`)
				.set("Authorization", `Bearer ${freeUser.accessToken}`)
				.expect(403);

			// Then - 403 에러와 FOLLOW_0909 코드 반환
			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("FOLLOW_0909");

			// When - 리소스 제한 조회
			const limitResponse = await request(ctx.app.getHttpServer())
				.get("/v1/follows/resource-limit")
				.set("Authorization", `Bearer ${freeUser.accessToken}`)
				.expect(200);

			// Then - 현재 친구 수와 한도가 FREE_LIMIT과 일치
			expect(limitResponse.body.data.friendCount).toBe(FREE_LIMIT);
			expect(limitResponse.body.data.maxCount).toBe(FREE_LIMIT);
		});
	});

	describe("Premium 유저 무제한", () => {
		it("Free 한도 초과해도 친구 요청 성공하고 maxCount가 null (무제한)", async () => {
			// Given - 프리미엄 유저 생성 및 구독 상태 변경
			const premiumUser = await ctx.helpers.createVerifiedUser(
				"follow-limit-premium@test.com",
				password,
			);

			const prisma = ctx.testDatabase.getPrisma();
			await prisma.user.update({
				where: { id: premiumUser.userId },
				data: { subscriptionStatus: "ACTIVE" },
			});

			// FREE_LIMIT + 1명의 친구 후보 생성
			const friends: VerifiedUser[] = [];
			for (let i = 0; i < FREE_LIMIT + 1; i++) {
				const friend = await ctx.helpers.createVerifiedUser(
					`follow-premium-friend-${i}@test.com`,
					password,
				);
				friends.push(friend);
			}

			// FREE_LIMIT명과 친구 관계 성립
			for (const friend of friends.slice(0, FREE_LIMIT)) {
				await ctx.helpers.createFriendship(premiumUser, friend);
			}

			// When - FREE_LIMIT + 1번째 친구 요청
			const extraFriend = friends[FREE_LIMIT];
			expect(extraFriend).toBeDefined();

			const response = await request(ctx.app.getHttpServer())
				.post(`/v1/follows/${extraFriend?.userTag}`)
				.set("Authorization", `Bearer ${premiumUser.accessToken}`)
				.expect(201);

			// Then - 친구 요청 성공
			expect(response.body.data.autoAccepted).toBe(false);

			// When - 리소스 제한 조회
			const limitResponse = await request(ctx.app.getHttpServer())
				.get("/v1/follows/resource-limit")
				.set("Authorization", `Bearer ${premiumUser.accessToken}`)
				.expect(200);

			// Then - maxCount가 null (무제한)이고 친구 수는 FREE_LIMIT
			expect(limitResponse.body.data.maxCount).toBeNull();
			expect(limitResponse.body.data.friendCount).toBe(FREE_LIMIT);
		});
	});
});
