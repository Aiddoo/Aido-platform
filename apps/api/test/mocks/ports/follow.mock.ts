import { vi } from "vitest";

import type { FollowCachePort } from "#api/modules/social/application/ports/friends/follow-cache.port";
import type { FollowNotifierPort } from "#api/modules/social/application/ports/friends/follow-notifier.port";
import type { FollowRepositoryPort } from "#api/modules/social/application/ports/friends/follow.repository.port";

/**
 * Follow 애플리케이션 포트 mock 팩토리 모음
 *
 * @suites/unit은 Symbol 토큰 포트를 안정적으로 auto-mock하지 못하므로 모든 메서드를
 * 명시합니다. 반환 타입을 포트 인터페이스로 강제해 포트 확장 시 누락을 타입 에러로 잡습니다.
 * 개별 메서드 mock API는 spec에서 `vi.mocked(mock.method)` 또는 `Mocked<Port>`로 접근합니다.
 */

export function createFollowRepositoryMock(): FollowRepositoryPort {
  return {
    create: vi.fn(),
    findByFollowerAndFollowing: vi.fn(),
    findByIdWithUser: vi.fn(),
    update: vi.fn(),
    updateByFollowerAndFollowing: vi.fn(),
    delete: vi.fn(),
    findMutualFriends: vi.fn(),
    findReceivedRequests: vi.fn(),
    findSentRequests: vi.fn(),
    searchUsers: vi.fn(),
    countSearchUsers: vi.fn(),
    findAcceptedByIdAndFollowerId: vi.fn(),
    getMaxSortOrderForFriends: vi.fn(),
    shiftFriendSortOrders: vi.fn(),
    updateFollowSortOrder: vi.fn(),
    isMutualFriend: vi.fn(),
    countMutualFriends: vi.fn(),
    countReceivedRequests: vi.fn(),
    countSentRequests: vi.fn(),
    userExists: vi.fn(),
    getUserDisplayName: vi.fn(),
    findUserByTag: vi.fn(),
    getMutualFriendIds: vi.fn(),
  };
}

export function createFollowNotifierMock(): FollowNotifierPort {
  return {
    notifyFollowNew: vi.fn(),
    notifyFollowMutual: vi.fn(),
    notifyFirstFriendMilestone: vi.fn(),
  };
}

export function createFollowCacheMock(): FollowCachePort {
  return {
    getMutualFriend: vi.fn(),
    setMutualFriend: vi.fn(),
    invalidateMutualFriend: vi.fn(),
    wrapMutualFriendIds: vi.fn(),
    invalidateMutualFriendIds: vi.fn(),
    wrapFriendCount: vi.fn(),
    invalidateFriendCount: vi.fn(),
  };
}
