/**
 * 캐시 무효화 E2E 테스트
 *
 * @description
 * 캐시 무효화 시나리오를 실제 환경과 유사하게 테스트합니다.
 * 캐시 모듈의 전체 라이프사이클과 무효화 동작을 검증합니다.
 */

import type { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { CacheModule } from "../../cache.module";
import { CacheService } from "../../cache.service";
import { CacheKeys } from "../../constants/cache-keys";
import { delay } from "../test-utils";

describe("캐시 무효화 E2E 테스트", () => {
	let app: INestApplication;
	let cacheService: CacheService;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({
					isGlobal: true,
					load: [
						() => ({
							CACHE_TYPE: "memory",
							CACHE_DEFAULT_TTL_MS: 60000,
							CACHE_MAX_ITEMS: 1000,
						}),
					],
				}),
				CacheModule.forRoot(),
			],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();

		cacheService = moduleFixture.get<CacheService>(CacheService);
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(async () => {
		await cacheService.reset();
	});

	describe("세션 캐시 무효화 시나리오", () => {
		it("로그인 후 세션이 캐시되고 로그아웃 시 무효화된다", async () => {
			// Given - 사용자 로그인 시뮬레이션
			const sessionId = "sess_e2e_test_123";
			const session = {
				userId: "user_e2e_1",
				expiresAt: new Date(Date.now() + 3600000),
				revokedAt: null,
			};

			// When - 세션 저장 (로그인)
			await cacheService.setSession(sessionId, session);

			// Then - 세션 조회 가능
			const cachedSession = await cacheService.getSession(sessionId);
			expect(cachedSession).toEqual(session);

			// When - 세션 무효화 (로그아웃)
			await cacheService.invalidateSession(sessionId);

			// Then - 세션 조회 불가
			const afterLogout = await cacheService.getSession(sessionId);
			expect(afterLogout).toBeUndefined();
		});

		it("세션 TTL 만료 시 자동으로 삭제된다", async () => {
			// Given - 짧은 TTL로 새 캐시 모듈 생성
			const shortTtlModule = await Test.createTestingModule({
				imports: [
					ConfigModule.forRoot({
						isGlobal: true,
						load: [
							() => ({
								CACHE_TYPE: "memory",
								CACHE_DEFAULT_TTL_MS: 50,
								CACHE_MAX_ITEMS: 100,
							}),
						],
					}),
					CacheModule.forRoot(),
				],
			}).compile();

			const shortTtlApp = shortTtlModule.createNestApplication();
			await shortTtlApp.init();
			const shortTtlCache = shortTtlModule.get<CacheService>(CacheService);

			const sessionId = "sess_short_ttl";
			const session = {
				userId: "user_ttl",
				expiresAt: new Date(),
				revokedAt: null,
			};

			// When - 세션 저장
			await shortTtlCache.setSession(sessionId, session);
			expect(await shortTtlCache.getSession(sessionId)).toEqual(session);

			// When - TTL 만료 대기
			await delay(100);

			// Then - 세션 자동 삭제
			const afterExpiry = await shortTtlCache.getSession(sessionId);
			expect(afterExpiry).toBeUndefined();

			await shortTtlApp.close();
		});
	});

	describe("사용자 프로필 캐시 무효화 시나리오", () => {
		it("프로필 수정 시 캐시가 무효화된다", async () => {
			// Given - 사용자 프로필 캐시
			const userId = "user_profile_e2e";
			const originalProfile = {
				id: userId,
				email: "original@test.com",
				name: "Original Name",
				userTag: "original#1234",
			};
			await cacheService.setUserProfile(userId, originalProfile);

			// When - 프로필 조회 (캐시 히트)
			const cachedProfile = await cacheService.getUserProfile(userId);
			expect(cachedProfile).toEqual(originalProfile);

			// When - 프로필 업데이트 시뮬레이션 (캐시 무효화)
			await cacheService.invalidateUserProfile(userId);

			// Then - 캐시 미스
			const afterUpdate = await cacheService.getUserProfile(userId);
			expect(afterUpdate).toBeUndefined();

			// When - 새 프로필 데이터로 캐시 업데이트
			const updatedProfile = {
				...originalProfile,
				name: "Updated Name",
			};
			await cacheService.setUserProfile(userId, updatedProfile);

			// Then - 새 데이터로 캐시 히트
			const newCachedProfile = await cacheService.getUserProfile(userId);
			expect(newCachedProfile).toEqual(updatedProfile);
		});

		it("여러 사용자 프로필이 독립적으로 관리된다", async () => {
			// Given - 여러 사용자 프로필 캐시
			const users = [
				{ id: "user_1", email: "u1@test.com", name: "User 1", userTag: "u1#1" },
				{ id: "user_2", email: "u2@test.com", name: "User 2", userTag: "u2#2" },
				{ id: "user_3", email: "u3@test.com", name: "User 3", userTag: "u3#3" },
			];

			for (const user of users) {
				await cacheService.setUserProfile(user.id, user);
			}

			// When - user_2 프로필만 무효화
			await cacheService.invalidateUserProfile("user_2");

			// Then - user_1, user_3는 캐시 유지, user_2는 삭제
			expect(await cacheService.getUserProfile("user_1")).toEqual(users[0]);
			expect(await cacheService.getUserProfile("user_2")).toBeUndefined();
			expect(await cacheService.getUserProfile("user_3")).toEqual(users[2]);
		});
	});

	describe("친구 관계 캐시 무효화 시나리오", () => {
		it("친구 추가/삭제 시 관련 캐시가 패턴으로 무효화된다", async () => {
			// Given - 친구 관계 캐시
			const userId = "user_friend_e2e";
			await cacheService.setMutualFriend(userId, "friend_1", true);
			await cacheService.setMutualFriend(userId, "friend_2", true);
			await cacheService.setMutualFriend(userId, "friend_3", false);

			// Then - 친구 관계 조회 가능
			expect(await cacheService.getMutualFriend(userId, "friend_1")).toBe(true);
			expect(await cacheService.getMutualFriend(userId, "friend_2")).toBe(true);
			expect(await cacheService.getMutualFriend(userId, "friend_3")).toBe(
				false,
			);

			// When - 친구 관계 변경으로 인한 일괄 무효화
			const deletedCount = await cacheService.invalidateFriendRelations(userId);

			// Then - 모든 친구 관계 캐시 삭제
			expect(deletedCount).toBe(3);
			expect(
				await cacheService.getMutualFriend(userId, "friend_1"),
			).toBeUndefined();
			expect(
				await cacheService.getMutualFriend(userId, "friend_2"),
			).toBeUndefined();
			expect(
				await cacheService.getMutualFriend(userId, "friend_3"),
			).toBeUndefined();
		});

		it("양방향 친구 관계가 독립적으로 캐시된다", async () => {
			// Given - 양방향 친구 관계 캐시
			await cacheService.setMutualFriend("user_a", "user_b", true);
			await cacheService.setMutualFriend("user_b", "user_a", true);

			// When - user_a의 친구 관계만 무효화
			await cacheService.invalidateFriendRelations("user_a");

			// Then - user_a→user_b는 삭제, user_b→user_a는 유지
			expect(
				await cacheService.getMutualFriend("user_a", "user_b"),
			).toBeUndefined();
			expect(await cacheService.getMutualFriend("user_b", "user_a")).toBe(true);
		});
	});

	describe("캐시 통계 모니터링 시나리오", () => {
		it("캐시 히트율을 추적할 수 있다", async () => {
			// Given - 캐시 데이터 설정
			await cacheService.set("key_1", "value_1");
			await cacheService.set("key_2", "value_2");

			// When - 히트 5회, 미스 2회
			await cacheService.get("key_1"); // hit
			await cacheService.get("key_2"); // hit
			await cacheService.get("key_1"); // hit
			await cacheService.get("key_2"); // hit
			await cacheService.get("key_1"); // hit
			await cacheService.get("non_existent_1"); // miss
			await cacheService.get("non_existent_2"); // miss

			// Then - 통계 확인
			const stats = cacheService.getStats();
			expect(stats.hits).toBe(5);
			expect(stats.misses).toBe(2);
			expect(stats.keys).toBe(2);

			const hitRate = (stats.hits / (stats.hits + stats.misses)) * 100;
			expect(hitRate).toBeCloseTo(71.43, 1);
		});

		it("리셋 후 통계가 초기화된다", async () => {
			// Given - 캐시 사용
			await cacheService.set("key_1", "value_1");
			await cacheService.get("key_1");
			await cacheService.get("miss");

			const statsBefore = cacheService.getStats();
			expect(statsBefore.hits).toBeGreaterThan(0);
			expect(statsBefore.misses).toBeGreaterThan(0);

			// When - 리셋
			await cacheService.reset();

			// Then - 통계 초기화
			const statsAfter = cacheService.getStats();
			expect(statsAfter.hits).toBe(0);
			expect(statsAfter.misses).toBe(0);
			expect(statsAfter.keys).toBe(0);
		});
	});

	describe("캐시 키 충돌 방지 시나리오", () => {
		it("서로 다른 도메인의 캐시가 충돌하지 않는다", async () => {
			// Given - 같은 ID를 가진 서로 다른 도메인 데이터
			const id = "same_id_123";

			const session = { userId: id, expiresAt: new Date(), revokedAt: null };
			const profile = {
				id,
				email: "test@test.com",
				name: "Test",
				userTag: "test#123",
			};
			const subscription = { status: "ACTIVE" as const };

			// When - 각 도메인에 저장
			await cacheService.setSession(id, session);
			await cacheService.setUserProfile(id, profile);
			await cacheService.setSubscription(id, subscription);

			// Then - 각 도메인에서 올바른 데이터 조회
			expect(await cacheService.getSession(id)).toEqual(session);
			expect(await cacheService.getUserProfile(id)).toEqual(profile);
			expect(await cacheService.getSubscription(id)).toEqual(subscription);

			// When - 프로필만 무효화
			await cacheService.invalidateUserProfile(id);

			// Then - 프로필만 삭제, 다른 도메인은 유지
			expect(await cacheService.getSession(id)).toEqual(session);
			expect(await cacheService.getUserProfile(id)).toBeUndefined();
			expect(await cacheService.getSubscription(id)).toEqual(subscription);
		});

		it("캐시 키가 설계대로 생성된다", async () => {
			// Given - 캐시 키 확인용 데이터
			const userId = "user_key_test";
			const targetId = "target_key_test";

			// Then - 캐시 키 형식 검증
			expect(CacheKeys.session("sess_123")).toBe("session:sess_123");
			expect(CacheKeys.userProfile(userId)).toBe(`user:profile:${userId}`);
			expect(CacheKeys.subscription(userId)).toBe(
				`user:subscription:${userId}`,
			);
			expect(CacheKeys.mutualFriend(userId, targetId)).toBe(
				`friends:mutual:${userId}:${targetId}`,
			);
		});
	});

	describe("LRU 캐시 퇴출 시나리오", () => {
		it("최대 항목 수 초과 시 가장 오래된 항목이 퇴출된다", async () => {
			// Given - 최대 항목 수가 5개인 캐시
			const smallCacheModule = await Test.createTestingModule({
				imports: [
					ConfigModule.forRoot({
						isGlobal: true,
						load: [
							() => ({
								CACHE_TYPE: "memory",
								CACHE_DEFAULT_TTL_MS: 60000,
								CACHE_MAX_ITEMS: 5,
							}),
						],
					}),
					CacheModule.forRoot(),
				],
			}).compile();

			const smallCacheApp = smallCacheModule.createNestApplication();
			await smallCacheApp.init();
			const smallCache = smallCacheModule.get<CacheService>(CacheService);

			// When - 5개 항목 저장
			for (let i = 1; i <= 5; i++) {
				await smallCache.set(`key_${i}`, `value_${i}`);
			}

			// Then - 5개 모두 존재
			expect(smallCache.getStats().keys).toBe(5);
			expect(await smallCache.get("key_1")).toBe("value_1");

			// When - 6번째 항목 추가 (LRU로 key_1 퇴출)
			await smallCache.set("key_6", "value_6");

			// Then - key_1은 퇴출, key_6은 존재
			expect(smallCache.getStats().keys).toBe(5);
			expect(await smallCache.get("key_1")).toBeUndefined();
			expect(await smallCache.get("key_6")).toBe("value_6");

			await smallCacheApp.close();
		});
	});
});
