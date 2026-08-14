/**
 * UpsertPushLocaleUseCase 단위 테스트
 *
 * 푸시 토큰 등록 시 로케일 upsert 위임(값 변형 없음).
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createUserPreferenceRepositoryMock } from "@test/mocks/ports/user-settings.mock";

import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";
import { UpsertPushLocaleUseCase } from "./upsert-push-locale.use-case";

const userId = "user-1";

describe("UpsertPushLocaleUseCase", () => {
	let useCase: UpsertPushLocaleUseCase;
	let repo: Mocked<UserPreferenceRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(UpsertPushLocaleUseCase)
			.mock<UserPreferenceRepositoryPort>(USER_PREFERENCE_REPOSITORY)
			.impl(() => createUserPreferenceRepositoryMock())
			.compile();
		useCase = unit;
		repo = unitRef.get<UserPreferenceRepositoryPort>(USER_PREFERENCE_REPOSITORY);
	});

	it("전달된 로케일을 그대로 upsertLocale에 위임한다", async () => {
		// Given: 로케일 upsert 성공
		repo.upsertLocale.mockResolvedValue(undefined);

		// When: 로케일 upsert 실행
		await useCase.execute(userId, "ko");

		// Then: userId + 로케일이 변형 없이 그대로 전달
		expect(repo.upsertLocale).toHaveBeenCalledTimes(1);
		expect(repo.upsertLocale).toHaveBeenCalledWith(userId, "ko");
	});

	it("리전 포함 로케일도 변형 없이 그대로 전달한다", async () => {
		// Given: 로케일 upsert 성공
		repo.upsertLocale.mockResolvedValue(undefined);

		// When: en-US 로케일 upsert
		await useCase.execute(userId, "en-US");

		// Then: 정규화 없이 원본 문자열 전달(정규화는 어댑터 책임)
		expect(repo.upsertLocale).toHaveBeenCalledWith(userId, "en-US");
	});
});
