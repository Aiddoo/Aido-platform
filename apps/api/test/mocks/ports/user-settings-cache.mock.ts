import type { UserSettingsCachePort } from "@/user-settings/application/ports/user-settings-cache.port";

/**
 * UserSettingsCachePort mock 팩토리.
 * 포트 확장 시 누락을 타입 에러로 잡습니다. 메서드 mock API는
 * `jest.mocked(mock.method)`로 접근합니다.
 */
export function createUserSettingsCacheMock(): UserSettingsCachePort {
	return {
		wrapUserPreference: jest.fn(),
		invalidateUserPreference: jest.fn(),
		invalidateActiveTimezones: jest.fn(),
	};
}
