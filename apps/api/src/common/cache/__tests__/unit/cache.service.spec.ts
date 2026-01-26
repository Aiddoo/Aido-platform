import { Test, TestingModule } from "@nestjs/testing";
import { CacheService } from "../../cache.service";
import { CACHE_SERVICE, ICacheService } from "../../interfaces/cache.interface";

describe("CacheService", () => {
	let service: CacheService;
	let mockCacheAdapter: jest.Mocked<ICacheService>;

	beforeEach(async () => {
		// Given - Mock 캐시 어댑터 설정
		mockCacheAdapter = {
			get: jest.fn(),
			set: jest.fn(),
			del: jest.fn(),
			delByPattern: jest.fn(),
			reset: jest.fn(),
			getStats: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CacheService,
				{ provide: CACHE_SERVICE, useValue: mockCacheAdapter },
			],
		}).compile();

		service = module.get<CacheService>(CacheService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("제네릭 메서드", () => {
		it("get 호출을 어댑터에 위임한다", async () => {
			// Given
			const key = "key";
			const expectedValue = "value";
			mockCacheAdapter.get.mockResolvedValue(expectedValue);

			// When
			const result = await service.get(key);

			// Then
			expect(mockCacheAdapter.get).toHaveBeenCalledWith(key);
			expect(result).toBe(expectedValue);
		});

		it("set 호출을 어댑터에 위임한다", async () => {
			// Given
			const key = "key";
			const value = "value";
			const ttlMs = 5000;

			// When
			await service.set(key, value, ttlMs);

			// Then
			expect(mockCacheAdapter.set).toHaveBeenCalledWith(key, value, ttlMs);
		});

		it("del 호출을 어댑터에 위임한다", async () => {
			// Given
			const key = "key";

			// When
			await service.del(key);

			// Then
			expect(mockCacheAdapter.del).toHaveBeenCalledWith(key);
		});

		it("delByPattern 호출을 어댑터에 위임한다", async () => {
			// Given
			const pattern = "user:*";
			const deletedCount = 5;
			mockCacheAdapter.delByPattern.mockResolvedValue(deletedCount);

			// When
			const result = await service.delByPattern(pattern);

			// Then
			expect(mockCacheAdapter.delByPattern).toHaveBeenCalledWith(pattern);
			expect(result).toBe(deletedCount);
		});

		it("reset 호출을 어댑터에 위임한다", async () => {
			// Given
			// - 어댑터가 준비됨

			// When
			await service.reset();

			// Then
			expect(mockCacheAdapter.reset).toHaveBeenCalled();
		});

		it("getStats 호출을 어댑터에 위임한다", () => {
			// Given
			const mockStats = { hits: 10, misses: 5, keys: 100, memoryUsage: 1024 };
			mockCacheAdapter.getStats.mockReturnValue(mockStats);

			// When
			const result = service.getStats();

			// Then
			expect(mockCacheAdapter.getStats).toHaveBeenCalled();
			expect(result).toEqual(mockStats);
		});
	});

	describe("세션 캐싱", () => {
		const sessionId = "sess_123";
		const sessionData = {
			userId: "user_1",
			expiresAt: new Date("2025-01-01"),
			revokedAt: null,
		};

		it("올바른 키로 세션을 조회한다", async () => {
			// Given
			mockCacheAdapter.get.mockResolvedValue(sessionData);

			// When
			const result = await service.getSession(sessionId);

			// Then
			expect(mockCacheAdapter.get).toHaveBeenCalledWith(`session:${sessionId}`);
			expect(result).toEqual(sessionData);
		});

		it("세션이 없으면 undefined를 반환한다", async () => {
			// Given
			mockCacheAdapter.get.mockResolvedValue(undefined);

			// When
			const result = await service.getSession(sessionId);

			// Then
			expect(result).toBeUndefined();
		});

		it("세션을 30초 TTL로 저장한다", async () => {
			// Given
			// - 세션 데이터가 준비됨

			// When
			await service.setSession(sessionId, sessionData);

			// Then
			expect(mockCacheAdapter.set).toHaveBeenCalledWith(
				`session:${sessionId}`,
				sessionData,
				30_000,
			);
		});

		it("세션을 무효화한다", async () => {
			// Given
			// - 세션 ID가 준비됨

			// When
			await service.invalidateSession(sessionId);

			// Then
			expect(mockCacheAdapter.del).toHaveBeenCalledWith(`session:${sessionId}`);
		});
	});

	describe("사용자 프로필 캐싱", () => {
		const userId = "user_1";
		const profile = {
			id: userId,
			email: "test@example.com",
			name: "Test User",
			userTag: "testuser#1234",
		};

		it("올바른 키로 사용자 프로필을 조회한다", async () => {
			// Given
			mockCacheAdapter.get.mockResolvedValue(profile);

			// When
			const result = await service.getUserProfile(userId);

			// Then
			expect(mockCacheAdapter.get).toHaveBeenCalledWith(
				`user:profile:${userId}`,
			);
			expect(result).toEqual(profile);
		});

		it("프로필이 없으면 undefined를 반환한다", async () => {
			// Given
			mockCacheAdapter.get.mockResolvedValue(undefined);

			// When
			const result = await service.getUserProfile(userId);

			// Then
			expect(result).toBeUndefined();
		});

		it("사용자 프로필을 5분 TTL로 저장한다", async () => {
			// Given
			// - 프로필 데이터가 준비됨

			// When
			await service.setUserProfile(userId, profile);

			// Then
			expect(mockCacheAdapter.set).toHaveBeenCalledWith(
				`user:profile:${userId}`,
				profile,
				5 * 60_000,
			);
		});

		it("사용자 프로필을 무효화한다", async () => {
			// Given
			// - 사용자 ID가 준비됨

			// When
			await service.invalidateUserProfile(userId);

			// Then
			expect(mockCacheAdapter.del).toHaveBeenCalledWith(
				`user:profile:${userId}`,
			);
		});
	});

	describe("구독 상태 캐싱", () => {
		const userId = "user_1";
		const subscription = {
			status: "ACTIVE" as const,
		};

		it("올바른 키로 구독 상태를 조회한다", async () => {
			// Given
			mockCacheAdapter.get.mockResolvedValue(subscription);

			// When
			const result = await service.getSubscription(userId);

			// Then
			expect(mockCacheAdapter.get).toHaveBeenCalledWith(
				`user:subscription:${userId}`,
			);
			expect(result).toEqual(subscription);
		});

		it("구독 정보가 없으면 undefined를 반환한다", async () => {
			// Given
			mockCacheAdapter.get.mockResolvedValue(undefined);

			// When
			const result = await service.getSubscription(userId);

			// Then
			expect(result).toBeUndefined();
		});

		it("구독 상태를 10분 TTL로 저장한다", async () => {
			// Given
			// - 구독 데이터가 준비됨

			// When
			await service.setSubscription(userId, subscription);

			// Then
			expect(mockCacheAdapter.set).toHaveBeenCalledWith(
				`user:subscription:${userId}`,
				subscription,
				10 * 60_000,
			);
		});

		it("구독 상태를 무효화한다", async () => {
			// Given
			// - 사용자 ID가 준비됨

			// When
			await service.invalidateSubscription(userId);

			// Then
			expect(mockCacheAdapter.del).toHaveBeenCalledWith(
				`user:subscription:${userId}`,
			);
		});
	});

	describe("상호 친구 캐싱", () => {
		const userId = "user_1";
		const targetUserId = "user_2";

		it("올바른 키로 상호 친구 상태를 조회한다", async () => {
			// Given
			mockCacheAdapter.get.mockResolvedValue(true);

			// When
			const result = await service.getMutualFriend(userId, targetUserId);

			// Then
			expect(mockCacheAdapter.get).toHaveBeenCalledWith(
				`friends:mutual:${userId}:${targetUserId}`,
			);
			expect(result).toBe(true);
		});

		it("캐시에 없으면 undefined를 반환한다", async () => {
			// Given
			mockCacheAdapter.get.mockResolvedValue(undefined);

			// When
			const result = await service.getMutualFriend(userId, targetUserId);

			// Then
			expect(result).toBeUndefined();
		});

		it("상호 친구 상태를 1분 TTL로 저장한다 (true)", async () => {
			// Given
			const isMutual = true;

			// When
			await service.setMutualFriend(userId, targetUserId, isMutual);

			// Then
			expect(mockCacheAdapter.set).toHaveBeenCalledWith(
				`friends:mutual:${userId}:${targetUserId}`,
				true,
				60_000,
			);
		});

		it("상호 친구가 아닌 상태도 캐싱한다 (false)", async () => {
			// Given
			const isMutual = false;

			// When
			await service.setMutualFriend(userId, targetUserId, isMutual);

			// Then
			expect(mockCacheAdapter.set).toHaveBeenCalledWith(
				`friends:mutual:${userId}:${targetUserId}`,
				false,
				60_000,
			);
		});

		it("사용자의 모든 친구 관계 캐시를 무효화한다", async () => {
			// Given
			const deletedCount = 5;
			mockCacheAdapter.delByPattern.mockResolvedValue(deletedCount);

			// When
			const result = await service.invalidateFriendRelations(userId);

			// Then
			expect(mockCacheAdapter.delByPattern).toHaveBeenCalledWith(
				`friends:mutual:${userId}:*`,
			);
			expect(result).toBe(deletedCount);
		});
	});

	describe("엣지 케이스", () => {
		it("동시 작업을 처리한다", async () => {
			// Given
			mockCacheAdapter.get.mockResolvedValue("value");
			mockCacheAdapter.set.mockResolvedValue(undefined);

			// When
			const operations = [
				service.get("key1"),
				service.set("key2", "value"),
				service.get("key3"),
				service.del("key4"),
			];
			await Promise.all(operations);

			// Then
			expect(mockCacheAdapter.get).toHaveBeenCalledTimes(2);
			expect(mockCacheAdapter.set).toHaveBeenCalledTimes(1);
			expect(mockCacheAdapter.del).toHaveBeenCalledTimes(1);
		});

		it("특수 문자가 포함된 사용자 ID를 처리한다", async () => {
			// Given
			const specialUserId = "user_with-special.chars@domain.com";

			// When
			await service.getUserProfile(specialUserId);

			// Then
			expect(mockCacheAdapter.get).toHaveBeenCalledWith(
				`user:profile:${specialUserId}`,
			);
		});
	});
});
