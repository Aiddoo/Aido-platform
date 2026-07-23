import type { UserConsentRepositoryPort } from "@/user-settings/application/ports/user-consent.repository.port";
import type { UserPreferenceRepositoryPort } from "@/user-settings/application/ports/user-preference.repository.port";

/**
 * UserPreferenceRepositoryPort mock 팩토리.
 * 포트 확장 시 누락을 타입 에러로 잡습니다. 메서드 mock API는
 * `jest.mocked(mock.method)`로 접근합니다.
 */
export function createUserPreferenceRepositoryMock(): UserPreferenceRepositoryPort {
	return {
		findByUserId: jest.fn(),
		findByUserIds: jest.fn(),
		create: jest.fn(),
		upsert: jest.fn(),
		upsertTimezone: jest.fn(),
		upsertLocale: jest.fn(),
		updateStreak: jest.fn(),
	};
}

/**
 * UserConsentRepositoryPort mock 팩토리.
 * 포트 확장 시 누락을 타입 에러로 잡습니다. 메서드 mock API는
 * `jest.mocked(mock.method)`로 접근합니다.
 */
export function createUserConsentRepositoryMock(): UserConsentRepositoryPort {
	return {
		findByUserId: jest.fn(),
		findByUserIds: jest.fn(),
		create: jest.fn(),
		upsertMarketingConsent: jest.fn(),
		upsertMarketingPushConsent: jest.fn(),
	};
}
