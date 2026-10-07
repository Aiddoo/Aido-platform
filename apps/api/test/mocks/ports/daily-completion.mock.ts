import { vi } from "vitest";

import type { DailyCompletionCachePort } from "#api/daily-completion/application/ports/daily-completion-cache.port";
import type { FriendPort } from "#api/daily-completion/application/ports/friend.port";

/**
 * DailyCompletion 애플리케이션 포트 mock 팩토리 모음.
 *
 * 반환 타입을 포트 인터페이스로 강제해 포트 확장 시 누락을 타입 에러로 잡습니다.
 * 개별 메서드 mock API는 `vi.mocked(mock.method)`로 접근합니다.
 */
export function createDailyCompletionCacheMock(): DailyCompletionCachePort {
  return {
    getRange: vi.fn(),
    setRange: vi.fn(),
    getPublicRange: vi.fn(),
    setPublicRange: vi.fn(),
    invalidate: vi.fn(),
  };
}

export function createDailyCompletionFriendMock(): FriendPort {
  return {
    isMutualFriend: vi.fn(),
  };
}
