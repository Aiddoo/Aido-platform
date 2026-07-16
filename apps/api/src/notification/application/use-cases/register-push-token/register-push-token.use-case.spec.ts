/**
 * RegisterPushTokenUseCase 단위 테스트
 *
 * - 토큰 형식 오류 → NOTIFICATION_1001 (저장 미수행)
 * - 정상: upsert + 캐시 무효화, timezone/locale 있을 때만 preference upsert + 무효화
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import {
	PUSH_PROVIDER,
	type PushProvider,
} from "../../ports/push-provider.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "../../ports/user-notification-settings.port";
import { RegisterPushTokenUseCase } from "./register-push-token.use-case";

describe("RegisterPushTokenUseCase", () => {
	let useCase: RegisterPushTokenUseCase;
	let repository: Mocked<NotificationRepositoryPort>;
	let pushProvider: Mocked<PushProvider>;
	let userSettings: Mocked<UserNotificationSettingsPort>;
	let cacheService: Mocked<CacheService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			RegisterPushTokenUseCase,
		).compile();
		useCase = unit;
		repository = unitRef.get(NOTIFICATION_REPOSITORY);
		pushProvider = unitRef.get(PUSH_PROVIDER);
		userSettings = unitRef.get(USER_NOTIFICATION_SETTINGS);
		cacheService = unitRef.get(CacheService);
	});

	it("토큰 형식이 유효하지 않으면 NOTIFICATION_1001을 던지고 저장하지 않는다", async () => {
		pushProvider.validateToken.mockReturnValue(false);

		await expect(
			useCase.execute({
				userId: "user-1",
				token: "bad",
				platform: "IOS",
			}),
		).rejects.toMatchObject({ errorCode: "NOTIFICATION_1001" });
		expect(repository.registerPushToken).not.toHaveBeenCalled();
	});

	it("timezone/locale 없으면 upsert·preference 무효화를 하지 않는다", async () => {
		pushProvider.validateToken.mockReturnValue(true);

		await useCase.execute({ userId: "user-1", token: "good", platform: "IOS" });

		expect(repository.registerPushToken).toHaveBeenCalledTimes(1);
		expect(cacheService.invalidatePushTokens).toHaveBeenCalledWith("user-1");
		expect(userSettings.upsertPushTimezone).not.toHaveBeenCalled();
		expect(userSettings.upsertPushLocale).not.toHaveBeenCalled();
		expect(cacheService.invalidateUserPreference).not.toHaveBeenCalled();
	});

	it("timezone/locale 있으면 preference upsert + 무효화한다", async () => {
		pushProvider.validateToken.mockReturnValue(true);

		await useCase.execute({
			userId: "user-1",
			token: "good",
			platform: "IOS",
			timezone: "Asia/Seoul",
			locale: "ko",
		});

		expect(userSettings.upsertPushTimezone).toHaveBeenCalledWith(
			"user-1",
			"Asia/Seoul",
		);
		expect(userSettings.upsertPushLocale).toHaveBeenCalledWith("user-1", "ko");
		expect(cacheService.invalidateUserPreference).toHaveBeenCalledWith(
			"user-1",
		);
	});

	it("잘못된 IANA 타임존은 토큰과 preference 어디에도 저장하지 않는다", async () => {
		pushProvider.validateToken.mockReturnValue(true);

		await useCase.execute({
			userId: "user-1",
			token: "good",
			platform: "IOS",
			timezone: "Mars/Olympus",
		});

		expect(repository.registerPushToken).toHaveBeenCalledWith(
			expect.objectContaining({ timezone: undefined }),
		);
		expect(userSettings.upsertPushTimezone).not.toHaveBeenCalled();
		expect(cacheService.invalidateUserPreference).not.toHaveBeenCalled();
	});
});
