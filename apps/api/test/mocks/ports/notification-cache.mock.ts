import { vi } from "vitest";

import type { NotificationCachePort } from "#api/modules/notification/application/ports/delivery/notification-cache.port";

/**
 * NotificationCachePort mock 팩토리.
 * 포트 확장 시 누락을 타입 에러로 잡습니다. 메서드 mock API는
 * `vi.mocked(mock.method)`로 접근합니다.
 */
export function createNotificationCacheMock(): NotificationCachePort {
  return {
    wrapUnreadCount: vi.fn(),
    invalidateUnreadCount: vi.fn(),
    invalidatePushTokens: vi.fn(),
    invalidateUserPreference: vi.fn(),
  };
}
