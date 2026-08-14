/**
 * RefreshPushTimezoneUseCase 단위 테스트
 *
 * 자가치유(핫패스): 저장 타임존이 다를 때만 갱신하고, 그때만 activeTimezones 캐시를 무효화한다.
 * 값이 같으면(0행) 캐시 무효화도 없어 sweep 캐시 thundering-herd를 피한다.
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
import { RefreshPushTimezoneUseCase } from "./refresh-push-timezone.use-case";

describe("RefreshPushTimezoneUseCase — 타임존 자가치유", () => {
	let useCase: RefreshPushTimezoneUseCase;
	let repo: Mocked<UserPreferenceRepositoryPort>;
	let cache: Mocked<UserSettingsCachePort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(RefreshPushTimezoneUseCase)
			.mock<UserSettingsCachePort>(USER_SETTINGS_CACHE)
			.impl(() => createUserSettingsCacheMock())
			.compile();
		useCase = unit;
		repo = unitRef.get(USER_PREFERENCE_REPOSITORY);
		cache = unitRef.get<UserSettingsCachePort>(USER_SETTINGS_CACHE);
	});

	it("타임존이 실제로 바뀌면(1행) activeTimezones 캐시를 무효화한다", async () => {
		repo.refreshTimezoneIfChanged.mockResolvedValue(1);

		await useCase.execute("user-1", "Asia/Seoul");

		expect(repo.refreshTimezoneIfChanged).toHaveBeenCalledWith("user-1", "Asia/Seoul");
		expect(cache.invalidateActiveTimezones).toHaveBeenCalledTimes(1);
	});

	it("변경이 없으면(0행) 캐시를 무효화하지 않는다 (thundering-herd 방지)", async () => {
		repo.refreshTimezoneIfChanged.mockResolvedValue(0);

		await useCase.execute("user-1", "Asia/Seoul");

		expect(repo.refreshTimezoneIfChanged).toHaveBeenCalledWith("user-1", "Asia/Seoul");
		expect(cache.invalidateActiveTimezones).not.toHaveBeenCalled();
	});
});
