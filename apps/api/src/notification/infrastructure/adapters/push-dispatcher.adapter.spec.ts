/**
 * PushDispatcherAdapter 단위 테스트 (자격 판단 경로)
 *
 * 발송 자격 판단은 preference 캐시(cache-aside)를 경유한다. 여기서는 결정적인
 * 기본값 경로(설정 미존재 → USER_PREFERENCE_DEFAULTS)를 검증한다.
 * 실제 푸시 전송·happy path는 notification.integration-spec이 end-to-end로 커버한다.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../application/ports/notification.repository.port";
import {
	type IPushRateLimiter,
	PUSH_RATE_LIMITER,
} from "../../application/ports/push-rate-limiter.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "../../application/ports/user-notification-settings.port";
import { PushDispatcherAdapter } from "./push-dispatcher.adapter";

describe("PushDispatcherAdapter", () => {
	let adapter: PushDispatcherAdapter;
	let userSettings: Mocked<UserNotificationSettingsPort>;
	let rateLimiter: Mocked<IPushRateLimiter>;
	let cacheService: Mocked<CacheService>;
	let repository: Mocked<NotificationRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			PushDispatcherAdapter,
		).compile();
		adapter = unit;
		userSettings = unitRef.get(USER_NOTIFICATION_SETTINGS);
		rateLimiter = unitRef.get(PUSH_RATE_LIMITER);
		cacheService = unitRef.get(CacheService);
		repository = unitRef.get(NOTIFICATION_REPOSITORY);

		// cache-aside: 캐시 미스 시 콜백을 실행하도록 passthrough
		cacheService.wrapUserPreference.mockImplementation((_userId, fn) => fn());
	});

	it("설정 미존재(기본값 pushEnabled=false)면 발송하지 않고 rate limit도 조회하지 않는다", async () => {
		userSettings.getPreferenceRecord.mockResolvedValue(null);

		const result = await adapter.shouldSendPush("user-1", "NUDGE_RECEIVED");

		expect(result).toBe(false);
		// pushEnabled 게이트가 먼저이므로 rate limit 조회 없음
		expect(rateLimiter.isRateLimited).not.toHaveBeenCalled();
	});

	it("설정 미존재면 기본 로케일(ko)을 반환한다", async () => {
		userSettings.getPreferenceRecord.mockResolvedValue(null);

		const locale = await adapter.getUserLocale("user-1");

		expect(locale).toBe("ko");
	});

	it("활성 토큰이 없으면 fireAndForgetPush는 조용히 종료한다", async () => {
		cacheService.wrapPushTokens.mockImplementation((_userId, fn) => fn());
		repository.findPushTokensByUser.mockResolvedValue([]);

		adapter.fireAndForgetPush(
			{ userId: "user-1", type: "NUDGE_RECEIVED", title: "t", body: "b" },
			1,
		);
		await adapter.beforeApplicationShutdown();

		expect(repository.findPushTokensByUser).toHaveBeenCalledWith({
			userId: "user-1",
			activeOnly: true,
		});
	});
});
