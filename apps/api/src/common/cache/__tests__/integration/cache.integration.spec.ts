import { ConfigModule } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { CacheModule } from "../../cache.module";
import { CacheService } from "../../cache.service";
import { CACHE_SERVICE, ICacheService } from "../../interfaces/cache.interface";
import { createMockUserProfile, delay, MockCacheAdapter } from "../test-utils";

describe("CacheModule 통합 테스트", () => {
	describe("인메모리 어댑터 (기본 설정)", () => {
		let module: TestingModule;
		let cacheService: CacheService;
		let cacheAdapter: ICacheService;

		beforeAll(async () => {
			module = await Test.createTestingModule({
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

			cacheService = module.get<CacheService>(CacheService);
			cacheAdapter = module.get<ICacheService>(CACHE_SERVICE);
		});

		afterAll(async () => {
			await module.close();
		});

		afterEach(async () => {
			await cacheService.reset();
		});

		describe("모듈 설정", () => {
			it("CacheService가 제공된다", () => {
				// Given
				// 모듈이 컴파일되었음

				// When
				const service = cacheService;

				// Then
				expect(service).toBeDefined();
			});

			it("ICacheService 어댑터가 제공된다", () => {
				// Given
				// 모듈이 컴파일되었음

				// When
				const adapter = cacheAdapter;

				// Then
				expect(adapter).toBeDefined();
			});
		});

		describe("세션 캐시 작업", () => {
			it("세션을 저장하고 조회하고 무효화할 수 있다", async () => {
				// Given
				const sessionId = "sess_1";
				const session = {
					userId: "u1",
					expiresAt: new Date(),
					revokedAt: null,
				};

				// When - 저장
				await cacheService.setSession(sessionId, session);

				// Then - 조회
				const cached = await cacheService.getSession(sessionId);
				expect(cached).toEqual(session);

				// When - 무효화
				await cacheService.invalidateSession(sessionId);

				// Then - 무효화 확인
				const afterInvalidate = await cacheService.getSession(sessionId);
				expect(afterInvalidate).toBeUndefined();
			});

			it("TTL이 만료되면 캐시가 삭제된다", async () => {
				// Given
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

				const shortTtlService = shortTtlModule.get<CacheService>(CacheService);
				await shortTtlService.set("test-key", "test-value");

				// When - 값이 설정됨을 확인
				const beforeExpiry = await shortTtlService.get("test-key");
				expect(beforeExpiry).toBe("test-value");

				// When - TTL 만료 대기
				await delay(100);

				// Then
				const afterExpiry = await shortTtlService.get("test-key");
				expect(afterExpiry).toBeUndefined();

				await shortTtlModule.close();
			});
		});

		describe("사용자 프로필 캐시 작업", () => {
			it("사용자 프로필을 캐시하고 조회할 수 있다", async () => {
				// Given
				const userId = "user_1";
				const profile = createMockUserProfile({
					id: userId,
					email: "test@example.com",
					name: "Test User",
					userTag: "testuser#1234",
				});

				// When
				await cacheService.setUserProfile(userId, profile);
				const cached = await cacheService.getUserProfile(userId);

				// Then
				expect(cached).toEqual(profile);
			});

			it("사용자 프로필을 무효화할 수 있다", async () => {
				// Given
				const userId = "user_2";
				const profile = createMockUserProfile({
					id: userId,
					email: "test2@example.com",
					name: "Test User 2",
					userTag: "testuser2#5678",
				});
				await cacheService.setUserProfile(userId, profile);

				// When
				await cacheService.invalidateUserProfile(userId);

				// Then
				const cached = await cacheService.getUserProfile(userId);
				expect(cached).toBeUndefined();
			});
		});

		describe("구독 캐시 작업", () => {
			it("구독 정보를 캐시하고 조회할 수 있다", async () => {
				// Given
				const userId = "user_1";
				const subscription = {
					status: "ACTIVE" as const,
				};

				// When
				await cacheService.setSubscription(userId, subscription);
				const cached = await cacheService.getSubscription(userId);

				// Then
				expect(cached).toEqual(subscription);
			});
		});

		describe("친구 관계 캐시 작업", () => {
			it("상호 친구 상태를 캐시하고 조회할 수 있다", async () => {
				// Given
				const userId = "user_1";

				// When
				await cacheService.setMutualFriend(userId, "user_2", true);
				await cacheService.setMutualFriend(userId, "user_3", false);

				// Then
				expect(await cacheService.getMutualFriend(userId, "user_2")).toBe(true);
				expect(await cacheService.getMutualFriend(userId, "user_3")).toBe(
					false,
				);
				expect(
					await cacheService.getMutualFriend(userId, "user_4"),
				).toBeUndefined();
			});

			it("패턴으로 친구 관계를 일괄 무효화할 수 있다", async () => {
				// Given
				await cacheService.setMutualFriend("user_1", "user_2", true);
				await cacheService.setMutualFriend("user_1", "user_3", true);
				await cacheService.setMutualFriend("user_2", "user_3", true);

				// When
				const count = await cacheService.invalidateFriendRelations("user_1");

				// Then
				expect(count).toBe(2);
				expect(
					await cacheService.getMutualFriend("user_1", "user_2"),
				).toBeUndefined();
				expect(
					await cacheService.getMutualFriend("user_1", "user_3"),
				).toBeUndefined();
				expect(await cacheService.getMutualFriend("user_2", "user_3")).toBe(
					true,
				);
			});
		});

		describe("동시성 처리", () => {
			it("100개의 동시 쓰기 작업을 처리할 수 있다", async () => {
				// Given
				const operations = Array.from({ length: 100 }, (_, i) =>
					cacheService.set(`key_${i}`, `value_${i}`),
				);

				// When
				await Promise.all(operations);

				// Then
				const stats = cacheService.getStats();
				expect(stats.keys).toBe(100);
			});

			it("읽기/쓰기/삭제 혼합 동시 작업을 처리할 수 있다", async () => {
				// Given
				await Promise.all([
					cacheService.set("key_1", "value_1"),
					cacheService.set("key_2", "value_2"),
					cacheService.set("key_3", "value_3"),
				]);

				// When
				const results = await Promise.all([
					cacheService.get("key_1"),
					cacheService.get("key_2"),
					cacheService.set("key_4", "value_4"),
					cacheService.del("key_3"),
					cacheService.get("key_5"),
				]);

				// Then
				expect(results[0]).toBe("value_1");
				expect(results[1]).toBe("value_2");
				expect(results[4]).toBeUndefined();
			});
		});

		describe("통계 추적", () => {
			it("히트와 미스를 정확하게 추적한다", async () => {
				// Given
				await cacheService.set("key_1", "value_1");
				await cacheService.set("key_2", "value_2");

				// When - 히트 3회
				await cacheService.get("key_1");
				await cacheService.get("key_2");
				await cacheService.get("key_1");

				// When - 미스 2회
				await cacheService.get("non_existent_1");
				await cacheService.get("non_existent_2");

				// Then
				const stats = cacheService.getStats();
				expect(stats.hits).toBe(3);
				expect(stats.misses).toBe(2);
				expect(stats.keys).toBe(2);
			});

			it("인메모리 어댑터에서 메모리 사용량을 포함한다", async () => {
				// Given
				const largeObject = { large: "object".repeat(100) };

				// When
				await cacheService.set("key_1", largeObject);
				const stats = cacheService.getStats();

				// Then
				expect(stats.memoryUsage).toBeDefined();
				expect(stats.memoryUsage).toBeGreaterThan(0);
			});
		});

		describe("리셋 작업", () => {
			it("모든 데이터와 통계를 초기화한다", async () => {
				// Given
				await cacheService.set("key_1", "value_1");
				await cacheService.set("key_2", "value_2");
				await cacheService.get("key_1");
				await cacheService.get("non_existent");

				// When
				await cacheService.reset();

				// Then
				const stats = cacheService.getStats();
				expect(stats.keys).toBe(0);
				expect(stats.hits).toBe(0);
				expect(stats.misses).toBe(0);
				expect(await cacheService.get("key_1")).toBeUndefined();
				expect(await cacheService.get("key_2")).toBeUndefined();
			});
		});

		describe("wrap 메서드", () => {
			it("캐시 미스 시 factory를 호출하고 결과를 캐싱한다", async () => {
				// Given
				const key = "wrap-test";
				const factory = jest.fn().mockResolvedValue("factory-value");

				// When
				const result = await cacheService.wrap(key, factory);

				// Then
				expect(result).toBe("factory-value");
				expect(factory).toHaveBeenCalledTimes(1);

				// 캐시 히트 확인
				const cachedResult = await cacheService.wrap(key, factory);
				expect(cachedResult).toBe("factory-value");
				expect(factory).toHaveBeenCalledTimes(1); // factory는 다시 호출되지 않음
			});

			it("TTL shorthand를 지원한다", async () => {
				// Given
				const key = "wrap-ttl-test";
				const factory = jest.fn().mockResolvedValue("value");

				// When
				await cacheService.wrap(key, factory, "1s");

				// Then - 즉시 조회
				const beforeExpiry = await cacheService.get(key);
				expect(beforeExpiry).toBe("value");

				// TTL 만료 후
				await delay(1100);
				const afterExpiry = await cacheService.get(key);
				expect(afterExpiry).toBeUndefined();
			});

			it("wrapSession이 실제로 캐시에 저장한다", async () => {
				// Given
				const sessionId = "wrap-session-test";
				const session = {
					userId: "u1",
					expiresAt: new Date(),
					revokedAt: null,
				};
				const factory = jest.fn().mockResolvedValue(session);

				// When
				const result = await cacheService.wrapSession(sessionId, factory);

				// Then
				expect(result).toEqual(session);
				expect(factory).toHaveBeenCalledTimes(1);

				// 캐시에서 직접 조회
				const cached = await cacheService.getSession(sessionId);
				expect(cached).toEqual(session);
			});

			it("wrapUserProfile이 실제로 캐시에 저장한다", async () => {
				// Given
				const userId = "wrap-profile-test";
				const profile = createMockUserProfile({
					id: userId,
					email: "test@example.com",
					name: "Test",
					userTag: "test#1234",
				});
				const factory = jest.fn().mockResolvedValue(profile);

				// When
				const result = await cacheService.wrapUserProfile(userId, factory);

				// Then
				expect(result).toEqual(profile);
				expect(factory).toHaveBeenCalledTimes(1);

				// 캐시에서 직접 조회
				const cached = await cacheService.getUserProfile(userId);
				expect(cached).toEqual(profile);
			});

			it("wrapMutualFriend가 실제로 캐시에 저장한다", async () => {
				// Given
				const userId = "wrap-friend-test-1";
				const targetUserId = "wrap-friend-test-2";
				const factory = jest.fn().mockResolvedValue(true);

				// When
				const result = await cacheService.wrapMutualFriend(
					userId,
					targetUserId,
					factory,
				);

				// Then
				expect(result).toBe(true);
				expect(factory).toHaveBeenCalledTimes(1);

				// 캐시에서 직접 조회
				const cached = await cacheService.getMutualFriend(userId, targetUserId);
				expect(cached).toBe(true);
			});
		});

		describe("배치 연산 (mget/mset)", () => {
			it("mset으로 여러 키를 한 번에 저장한다", async () => {
				// Given
				const entries = [
					{ key: "mset-1", value: "value-1" },
					{ key: "mset-2", value: "value-2" },
					{ key: "mset-3", value: "value-3" },
				];

				// When
				await cacheService.mset(entries);

				// Then
				expect(await cacheService.get("mset-1")).toBe("value-1");
				expect(await cacheService.get("mset-2")).toBe("value-2");
				expect(await cacheService.get("mset-3")).toBe("value-3");
			});

			it("mget으로 여러 키를 한 번에 조회한다", async () => {
				// Given
				await cacheService.set("mget-1", "value-1");
				await cacheService.set("mget-2", "value-2");

				// When
				const results = await cacheService.mget([
					"mget-1",
					"mget-2",
					"mget-nonexistent",
				]);

				// Then
				expect(results).toEqual(["value-1", "value-2", undefined]);
			});

			it("mset에서 TTL shorthand를 지원한다", async () => {
				// Given
				const entries = [
					{ key: "mset-ttl-1", value: "value-1", ttl: "1s" as const },
					{ key: "mset-ttl-2", value: "value-2", ttl: "1s" as const },
				];

				// When
				await cacheService.mset(entries);

				// Then - 즉시 조회
				const beforeExpiry = await cacheService.mget([
					"mset-ttl-1",
					"mset-ttl-2",
				]);
				expect(beforeExpiry).toEqual(["value-1", "value-2"]);

				// TTL 만료 후
				await delay(1100);
				const afterExpiry = await cacheService.mget([
					"mset-ttl-1",
					"mset-ttl-2",
				]);
				expect(afterExpiry).toEqual([undefined, undefined]);
			});
		});

		describe("TTL 관리 메서드 (has/ttl/touch)", () => {
			it("has로 키 존재 여부를 확인한다", async () => {
				// Given
				await cacheService.set("has-test", "value");

				// When & Then
				expect(await cacheService.has("has-test")).toBe(true);
				expect(await cacheService.has("nonexistent")).toBe(false);
			});

			it("ttl로 남은 TTL을 조회한다", async () => {
				// Given
				await cacheService.set("ttl-test", "value", 5000);

				// When
				const remainingTtl = await cacheService.ttl("ttl-test");

				// Then
				expect(remainingTtl).toBeGreaterThan(0);
				expect(remainingTtl).toBeLessThanOrEqual(5000);
			});

			it("ttl이 존재하지 않는 키에 대해 -2를 반환한다", async () => {
				// When
				const result = await cacheService.ttl("nonexistent-key");

				// Then
				expect(result).toBe(-2);
			});

			it("touch로 TTL을 갱신한다", async () => {
				// Given
				await cacheService.set("touch-test", "value", 1000);

				// When
				const success = await cacheService.touch("touch-test", 10000);

				// Then
				expect(success).toBe(true);
				const newTtl = await cacheService.ttl("touch-test");
				expect(newTtl).toBeGreaterThan(5000); // 새 TTL이 적용됨
			});

			it("touch가 존재하지 않는 키에 대해 false를 반환한다", async () => {
				// When
				const result = await cacheService.touch("nonexistent", 5000);

				// Then
				expect(result).toBe(false);
			});

			it("touch에서 TTL shorthand를 지원한다", async () => {
				// Given
				await cacheService.set("touch-shorthand", "value", 1000);

				// When
				const success = await cacheService.touch("touch-shorthand", "1m");

				// Then
				expect(success).toBe(true);
				const newTtl = await cacheService.ttl("touch-shorthand");
				expect(newTtl).toBeGreaterThan(50000); // 약 1분
			});
		});
	});

	describe("forTesting 헬퍼", () => {
		it("커스텀 어댑터를 주입할 수 있다", async () => {
			// Given
			const mockAdapter = new MockCacheAdapter();
			const module = await Test.createTestingModule({
				imports: [CacheModule.forTesting(mockAdapter)],
			}).compile();
			const service = module.get<CacheService>(CacheService);

			// When
			await service.set("key", "value");
			const result = await service.get("key");

			// Then
			expect(result).toBe("value");
			expect(mockAdapter.hasKey("key")).toBe(true);

			await module.close();
		});

		it("Jest 모킹된 어댑터를 사용할 수 있다", async () => {
			// Given
			const mockAdapter: ICacheService = {
				get: jest.fn().mockResolvedValue("mocked-value"),
				set: jest.fn(),
				del: jest.fn(),
				delByPattern: jest.fn(),
				reset: jest.fn(),
				getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, keys: 0 }),
				wrap: jest.fn().mockImplementation((_key, factory) => factory()),
				mget: jest.fn().mockResolvedValue([]),
				mset: jest.fn(),
				has: jest.fn().mockResolvedValue(false),
				ttl: jest.fn().mockResolvedValue(-2),
				touch: jest.fn().mockResolvedValue(false),
			};
			const module = await Test.createTestingModule({
				imports: [CacheModule.forTesting(mockAdapter)],
			}).compile();
			const service = module.get<CacheService>(CacheService);

			// When
			const result = await service.get("any");

			// Then
			expect(result).toBe("mocked-value");
			expect(mockAdapter.get).toHaveBeenCalledWith("any");

			await module.close();
		});

		it("모킹된 wrap 메서드를 사용할 수 있다", async () => {
			// Given
			const mockAdapter: ICacheService = {
				get: jest.fn(),
				set: jest.fn(),
				del: jest.fn(),
				delByPattern: jest.fn(),
				reset: jest.fn(),
				getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, keys: 0 }),
				wrap: jest.fn().mockResolvedValue("wrapped-value"),
				mget: jest.fn(),
				mset: jest.fn(),
				has: jest.fn(),
				ttl: jest.fn(),
				touch: jest.fn(),
			};
			const module = await Test.createTestingModule({
				imports: [CacheModule.forTesting(mockAdapter)],
			}).compile();
			const service = module.get<CacheService>(CacheService);

			// When
			const factory = jest.fn();
			const result = await service.wrap("key", factory, "5m");

			// Then
			expect(result).toBe("wrapped-value");
			expect(mockAdapter.wrap).toHaveBeenCalledWith("key", factory, "5m");

			await module.close();
		});
	});

	describe("설정", () => {
		it("환경 변수가 없으면 기본값을 사용한다", async () => {
			// Given
			const module = await Test.createTestingModule({
				imports: [
					ConfigModule.forRoot({
						isGlobal: true,
						load: [() => ({})],
					}),
					CacheModule.forRoot(),
				],
			}).compile();
			const service = module.get<CacheService>(CacheService);

			// When
			await service.set("key", "value");
			const result = await service.get("key");

			// Then
			expect(result).toBe("value");

			await module.close();
		});

		it("커스텀 설정을 적용한다", async () => {
			// Given
			const module = await Test.createTestingModule({
				imports: [
					ConfigModule.forRoot({
						isGlobal: true,
						load: [
							() => ({
								CACHE_TYPE: "memory",
								CACHE_DEFAULT_TTL_MS: 100,
								CACHE_MAX_ITEMS: 5,
							}),
						],
					}),
					CacheModule.forRoot(),
				],
			}).compile();
			const service = module.get<CacheService>(CacheService);

			// When - 최대 항목 수를 초과하여 저장
			for (let i = 0; i < 10; i++) {
				await service.set(`key_${i}`, `value_${i}`);
			}

			// Then - LRU로 인해 최대 5개만 유지
			const stats = service.getStats();
			expect(stats.keys).toBeLessThanOrEqual(5);

			await module.close();
		});
	});

	describe("글로벌 모듈 동작", () => {
		it("import 없이 전역으로 사용 가능하다", async () => {
			// Given
			const module = await Test.createTestingModule({
				imports: [
					ConfigModule.forRoot({
						isGlobal: true,
						load: [() => ({ CACHE_TYPE: "memory" })],
					}),
					CacheModule.forRoot(),
				],
			}).compile();

			// When
			const service = module.get<CacheService>(CacheService);
			const adapter = module.get<ICacheService>(CACHE_SERVICE);

			// Then
			expect(service).toBeDefined();
			expect(adapter).toBeDefined();

			await module.close();
		});
	});
});
