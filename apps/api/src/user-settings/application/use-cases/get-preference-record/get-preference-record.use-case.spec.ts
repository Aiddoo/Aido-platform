/**
 * GetPreferenceRecordUseCase 단위 테스트
 *
 * 푸시 발송 판단용 단건 설정 원본 레코드 조회(프리미엄 게이팅/뷰 매핑 없음).
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createUserPreferenceRepositoryMock } from "@test/mocks/ports/user-settings.mock";

import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRecord,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";
import { GetPreferenceRecordUseCase } from "./get-preference-record.use-case";

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
	currentStreak: 3,
	longestStreak: 10,
	lastCompletedDate: new Date("2024-05-01T00:00:00.000Z"),
};

describe("GetPreferenceRecordUseCase", () => {
	let useCase: GetPreferenceRecordUseCase;
	let repo: Mocked<UserPreferenceRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetPreferenceRecordUseCase)
			.mock<UserPreferenceRepositoryPort>(USER_PREFERENCE_REPOSITORY)
			.impl(() => createUserPreferenceRepositoryMock())
			.compile();
		useCase = unit;
		repo = unitRef.get<UserPreferenceRepositoryPort>(
			USER_PREFERENCE_REPOSITORY,
		);
	});

	it("게이팅 없이 원본 레코드를 그대로 반환한다", async () => {
		// Given: 저장된 리마인더 시간(07:30)을 포함한 원본 레코드
		repo.findByUserId.mockResolvedValue(record);

		// When: 단건 조회
		const result = await useCase.execute(userId);

		// Then: 프리미엄 기본값 치환 없이 저장값 그대로(스트릭 필드 포함)
		expect(repo.findByUserId).toHaveBeenCalledWith(userId);
		expect(result).toBe(record);
	});

	it("레코드가 없으면 null을 반환한다", async () => {
		// Given: 설정 레코드 미존재
		repo.findByUserId.mockResolvedValue(null);

		// When: 단건 조회
		const result = await useCase.execute(userId);

		// Then: null 그대로 전달
		expect(result).toBeNull();
	});
});
