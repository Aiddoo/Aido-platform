/**
 * UpdatePreferenceUseCase 단위 테스트
 *
 * - 리마인더 변경 프리미엄 게이트(PREFERENCE_1701)
 * - 시간 범위 불변식(PREFERENCE_1702)
 * - 캐시 무효화 + 즉시 반영 잡 등록
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createUserSettingsCacheMock } from "@test/mocks/ports";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import type { UserPreferenceRecord } from "../../../domain/records/user-preference.record";

import {
	REMINDER_SCHEDULE_ENQUEUER,
	type ReminderScheduleEnqueuerPort,
} from "../../ports/reminder-schedule.enqueuer.port";
import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";
import {
	USER_SETTINGS_CACHE,
	type UserSettingsCachePort,
} from "../../ports/user-settings-cache.port";
import { UpdatePreferenceUseCase } from "./update-preference.use-case";

const userId = "user-1";

const record: UserPreferenceRecord = {
	pushEnabled: true,
	nightPushEnabled: true,
	timezone: "Asia/Seoul",
	locale: "ko",
	morningReminderHour: 7,
	morningReminderMinute: 30,
	eveningReminderHour: 18,
	eveningReminderMinute: 0,
	timeFormat: "TWELVE_HOUR",
	weatherMorningEnabled: true,
	weatherMorningHour: 7,
	weatherMorningMinute: 0,
	weatherEveningEnabled: true,
	weatherEveningHour: 17,
	weatherEveningMinute: 30,
	currentStreak: 0,
	longestStreak: 0,
	lastCompletedDate: null,
};

describe("UpdatePreferenceUseCase", () => {
	let useCase: UpdatePreferenceUseCase;
	let repo: Mocked<UserPreferenceRepositoryPort>;
	let entitlement: Mocked<EntitlementService>;
	let cache: Mocked<UserSettingsCachePort>;
	let enqueuer: Mocked<ReminderScheduleEnqueuerPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(UpdatePreferenceUseCase)
			.mock<UserSettingsCachePort>(USER_SETTINGS_CACHE)
			.impl(() => createUserSettingsCacheMock())
			.compile();
		useCase = unit;
		repo = unitRef.get(USER_PREFERENCE_REPOSITORY);
		entitlement = unitRef.get(EntitlementService);
		cache = unitRef.get<UserSettingsCachePort>(USER_SETTINGS_CACHE);
		enqueuer = unitRef.get(REMINDER_SCHEDULE_ENQUEUER);
		repo.upsert.mockResolvedValue(record);
	});

	it("비프리미엄이 리마인더 시간 변경 시 PREFERENCE_1701, upsert 미호출", async () => {
		entitlement.hasPremiumAccess.mockResolvedValue(false);

		await expect(
			useCase.execute(userId, { morningReminderHour: 7 }),
		).rejects.toMatchObject({ errorCode: "PREFERENCE_1701" });
		expect(repo.upsert).not.toHaveBeenCalled();
	});

	it("범위 밖 아침 리마인더는 PREFERENCE_1702", async () => {
		entitlement.hasPremiumAccess.mockResolvedValue(true);

		await expect(
			useCase.execute(userId, { morningReminderHour: 13 }),
		).rejects.toMatchObject({ errorCode: "PREFERENCE_1702" });
	});

	it("프리미엄 리마인더 변경 → upsert·캐시 무효화·즉시 반영 잡 등록", async () => {
		entitlement.hasPremiumAccess.mockResolvedValue(true);

		await useCase.execute(userId, {
			morningReminderHour: 7,
			morningReminderMinute: 30,
		});

		expect(repo.upsert).toHaveBeenCalledTimes(1);
		expect(cache.invalidateUserPreference).toHaveBeenCalledWith(userId);
		expect(enqueuer.enqueueReminderHourChanged).toHaveBeenCalledWith(
			expect.objectContaining({
				userId,
				timezone: "Asia/Seoul",
				morningReminderHour: 7,
				morningReminderMinute: 30,
			}),
		);
	});

	it("타임존/pushEnabled 변경 시 활성 타임존 캐시도 무효화, 리마인더 잡 미등록", async () => {
		await useCase.execute(userId, { pushEnabled: false });

		expect(entitlement.hasPremiumAccess).not.toHaveBeenCalled();
		expect(cache.invalidateActiveTimezones).toHaveBeenCalledTimes(1);
		expect(enqueuer.enqueueReminderHourChanged).not.toHaveBeenCalled();
	});

	it("유효한 IANA 타임존 별칭은 정규 타임존으로 저장한다", async () => {
		await useCase.execute(userId, { timezone: "Etc/UTC" });

		expect(repo.upsert).toHaveBeenCalledWith(
			userId,
			expect.objectContaining({ timezone: "UTC" }),
		);
	});

	it("유효하지 않은 타임존은 SYS_0002로 거부하고 저장하지 않는다", async () => {
		await expect(
			useCase.execute(userId, { timezone: "Invalid/Timezone" }),
		).rejects.toMatchObject({
			errorCode: "SYS_0002",
			details: { field: "timezone" },
		});
		expect(repo.upsert).not.toHaveBeenCalled();
	});
});
