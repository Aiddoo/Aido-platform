import { vi } from "vitest";

import type { UserConsentRepositoryPort } from "#api/user-settings/application/ports/user-consent.repository.port";
import type { UserPreferenceRepositoryPort } from "#api/user-settings/application/ports/user-preference.repository.port";

/**
 * UserPreferenceRepositoryPort mock 팩토리.
 * 포트 확장 시 누락을 타입 에러로 잡습니다. 메서드 mock API는
 * `vi.mocked(mock.method)`로 접근합니다.
 */
export function createUserPreferenceRepositoryMock(): UserPreferenceRepositoryPort {
	return {
		findByUserId: vi.fn(),
		findByUserIds: vi.fn(),
		create: vi.fn(),
		upsert: vi.fn(),
		upsertTimezone: vi.fn(),
		refreshTimezoneIfChanged: vi.fn(),
		upsertLocale: vi.fn(),
		updateStreak: vi.fn(),
	};
}

/**
 * UserConsentRepositoryPort mock 팩토리.
 * 포트 확장 시 누락을 타입 에러로 잡습니다. 메서드 mock API는
 * `vi.mocked(mock.method)`로 접근합니다.
 */
export function createUserConsentRepositoryMock(): UserConsentRepositoryPort {
	return {
		findByUserId: vi.fn(),
		findByUserIds: vi.fn(),
		create: vi.fn(),
		upsertMarketingConsent: vi.fn(),
		upsertMarketingPushConsent: vi.fn(),
	};
}
