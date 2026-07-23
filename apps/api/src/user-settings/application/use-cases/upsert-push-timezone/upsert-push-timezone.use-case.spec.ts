/**
 * UpsertPushTimezoneUseCase 단위 테스트
 *
 * 푸시 토큰 등록 시 타임존 upsert 후 activeTimezones 캐시 무효화 검증
 * (새 타임존이 스케줄러 활성 목록에서 누락되지 않도록 — update-preference와 대칭)
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createUserSettingsCacheMock } from "@test/mocks/ports";
import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";
import {
	USER_SETTINGS_CACHE,
	type UserSettingsCachePort,
} from "../../ports/user-settings-cache.port";
import { UpsertPushTimezoneUseCase } from "./upsert-push-timezone.use-case";

describe("UpsertPushTimezoneUseCase — 푸시 토큰 등록 시 타임존 upsert", () => {
	let useCase: UpsertPushTimezoneUseCase;
	let repo: Mocked<UserPreferenceRepositoryPort>;
	let cache: Mocked<UserSettingsCachePort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(UpsertPushTimezoneUseCase)
			.mock<UserSettingsCachePort>(USER_SETTINGS_CACHE)
			.impl(() => createUserSettingsCacheMock())
			.compile();
		useCase = unit;
		repo = unitRef.get(USER_PREFERENCE_REPOSITORY);
		cache = unitRef.get<UserSettingsCachePort>(USER_SETTINGS_CACHE);
	});

	it("타임존을 upsert하고 activeTimezones 캐시를 무효화한다", async () => {
		// Given
		repo.upsertTimezone.mockResolvedValue(undefined);

		// When
		await useCase.execute("user-1", "Asia/Seoul");

		// Then - upsert 후 활성 타임존 목록 캐시 무효화 (스테일 방지)
		expect(repo.upsertTimezone).toHaveBeenCalledWith("user-1", "Asia/Seoul");
		expect(cache.invalidateActiveTimezones).toHaveBeenCalledTimes(1);
	});
});
