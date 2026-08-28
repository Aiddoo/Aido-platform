import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { PushTokenBuilder } from "@test/builders";
import { createPushTokenRepositoryMock } from "@test/mocks/ports/notification.mock";

import { CacheService } from "@/shared/infrastructure/cache/cache.service";

import {
	PUSH_TOKEN_REPOSITORY,
	type PushTokenRepositoryPort,
} from "../../application/ports/push-token.repository.port";
import {
	NOTIFICATION_CACHE_TTL_MS,
	NotificationCacheKey,
} from "../cache/notification-cache.keyspace";
import { CachedActivePushTokenReaderAdapter } from "./cached-active-push-token-reader.adapter";

describe("CachedActivePushTokenReaderAdapter - 활성 푸시 토큰 cache-aside", () => {
	let reader: CachedActivePushTokenReaderAdapter;
	let pushTokenRepository: Mocked<PushTokenRepositoryPort>;
	let cacheService: Mocked<CacheService>;

	beforeEach(async () => {
		PushTokenBuilder.resetIdCounter();

		const { unit, unitRef } = await TestBed.solitary(CachedActivePushTokenReaderAdapter)
			.mock<PushTokenRepositoryPort>(PUSH_TOKEN_REPOSITORY)
			.impl(() => createPushTokenRepositoryMock())
			.compile();

		reader = unit;
		pushTokenRepository = unitRef.get(PUSH_TOKEN_REPOSITORY);
		cacheService = unitRef.get(CacheService);
	});

	it("단건 캐시 미스는 활성 토큰만 저장소에서 읽는 loader를 실행한다", async () => {
		// Given - CacheService가 cache-aside loader를 실행하는 캐시 미스
		const userId = "user-single";
		const records = [
			PushTokenBuilder.create(userId).withToken("ExponentPushToken[first]").build(),
			PushTokenBuilder.create(userId).withToken("ExponentPushToken[second]").build(),
		];
		cacheService.wrapPushTokens.mockImplementation((_cachedUserId, loader) => loader());
		pushTokenRepository.findPushTokensByUser.mockResolvedValue(records);

		// When - 단건 활성 토큰 조회
		const result = await reader.findByUserId(userId);

		// Then - 기존 단건 cache-aside 쿼리와 토큰 순서를 보존
		expect(cacheService.wrapPushTokens).toHaveBeenCalledWith(userId, expect.any(Function));
		expect(pushTokenRepository.findPushTokensByUser).toHaveBeenCalledWith({
			userId,
			activeOnly: true,
		});
		expect(result).toEqual(["ExponentPushToken[first]", "ExponentPushToken[second]"]);
	});

	it("단건 캐시 히트는 저장소를 조회하지 않는다", async () => {
		// Given - 이미 캐시된 활성 토큰
		cacheService.wrapPushTokens.mockResolvedValue(["ExponentPushToken[cached]"]);

		// When - 단건 활성 토큰 조회
		const result = await reader.findByUserId("user-cached");

		// Then - 캐시 값만 반환하고 DB를 우회
		expect(result).toEqual(["ExponentPushToken[cached]"]);
		expect(pushTokenRepository.findPushTokensByUser).not.toHaveBeenCalled();
	});

	it("배치는 캐시 누락 사용자만 한 번에 조회하고 토큰이 없는 사용자도 음수 캐시한다", async () => {
		// Given - 한 사용자는 캐시 히트, 두 사용자는 캐시 미스
		const cachedUserId = "user-cached";
		const loadedUserId = "user-loaded";
		const tokenlessUserId = "user-tokenless";
		cacheService.mget.mockResolvedValue([["ExponentPushToken[cached]"], undefined, undefined]);
		pushTokenRepository.findActivePushTokensByUsers.mockResolvedValue([
			PushTokenBuilder.create(loadedUserId).withToken("ExponentPushToken[loaded-first]").build(),
			PushTokenBuilder.create(loadedUserId).withToken("ExponentPushToken[loaded-second]").build(),
		]);

		// When - 배치 활성 토큰 조회
		const result = await reader.findByUserIds([cachedUserId, loadedUserId, tokenlessUserId]);

		// Then - miss만 DB에서 읽고 빈 배열까지 같은 TTL로 저장
		expect(cacheService.mget).toHaveBeenCalledTimes(1);
		expect(cacheService.mget).toHaveBeenCalledWith([
			NotificationCacheKey.pushTokens(cachedUserId),
			NotificationCacheKey.pushTokens(loadedUserId),
			NotificationCacheKey.pushTokens(tokenlessUserId),
		]);
		expect(pushTokenRepository.findActivePushTokensByUsers).toHaveBeenCalledTimes(1);
		expect(pushTokenRepository.findActivePushTokensByUsers).toHaveBeenCalledWith([
			loadedUserId,
			tokenlessUserId,
		]);
		expect(cacheService.mset).toHaveBeenCalledWith([
			{
				key: NotificationCacheKey.pushTokens(loadedUserId),
				value: ["ExponentPushToken[loaded-first]", "ExponentPushToken[loaded-second]"],
				ttl: NOTIFICATION_CACHE_TTL_MS.PUSH_TOKENS,
			},
			{
				key: NotificationCacheKey.pushTokens(tokenlessUserId),
				value: [],
				ttl: NOTIFICATION_CACHE_TTL_MS.PUSH_TOKENS,
			},
		]);
		expect([...result]).toEqual([
			[cachedUserId, ["ExponentPushToken[cached]"]],
			[loadedUserId, ["ExponentPushToken[loaded-first]", "ExponentPushToken[loaded-second]"]],
		]);
		expect(result.has(tokenlessUserId)).toBe(false);
	});

	it("배치 캐시 히트는 빈 토큰 배열을 유지하면서 저장소와 캐시 쓰기를 생략한다", async () => {
		// Given - 모든 사용자가 캐시 히트하고 한 사용자는 토큰이 없음
		cacheService.mget.mockResolvedValue([["ExponentPushToken[cached]"], []]);

		// When - 배치 활성 토큰 조회
		const result = await reader.findByUserIds(["user-with-token", "user-without-token"]);

		// Then - 토큰 보유 사용자만 결과에 포함하고 추가 I/O 없음
		expect([...result]).toEqual([["user-with-token", ["ExponentPushToken[cached]"]]]);
		expect(pushTokenRepository.findActivePushTokensByUsers).not.toHaveBeenCalled();
		expect(cacheService.mset).not.toHaveBeenCalled();
	});

	it("빈 배치 입력은 캐시와 저장소를 조회하지 않는다", async () => {
		// Given - 조회할 사용자 없음

		// When - 빈 배치 조회
		const result = await reader.findByUserIds([]);

		// Then - 빈 읽기 모델을 즉시 반환
		expect(result.size).toBe(0);
		expect(cacheService.mget).not.toHaveBeenCalled();
		expect(pushTokenRepository.findActivePushTokensByUsers).not.toHaveBeenCalled();
		expect(cacheService.mset).not.toHaveBeenCalled();
	});
});
