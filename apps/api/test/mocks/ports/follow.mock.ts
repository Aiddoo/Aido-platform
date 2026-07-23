import type { FollowRepositoryPort } from "@/follow/application/ports/follow.repository.port";
import type { FollowCachePort } from "@/follow/application/ports/follow-cache.port";
import type { FollowNotifierPort } from "@/follow/application/ports/follow-notifier.port";

/**
 * Follow 애플리케이션 포트 mock 팩토리 모음
 *
 * @suites/unit은 Symbol 토큰 포트를 안정적으로 auto-mock하지 못하므로 모든 메서드를
 * 명시합니다. 반환 타입을 포트 인터페이스로 강제해 포트 확장 시 누락을 타입 에러로 잡습니다.
 * 개별 메서드 mock API는 spec에서 `jest.mocked(mock.method)` 또는 `Mocked<Port>`로 접근합니다.
 */

export function createFollowRepositoryMock(): FollowRepositoryPort {
	return {
		create: jest.fn(),
		findByFollowerAndFollowing: jest.fn(),
		findByIdWithUser: jest.fn(),
		update: jest.fn(),
		updateByFollowerAndFollowing: jest.fn(),
		delete: jest.fn(),
		findMutualFriends: jest.fn(),
		findReceivedRequests: jest.fn(),
		findSentRequests: jest.fn(),
		searchUsers: jest.fn(),
		countSearchUsers: jest.fn(),
		findAcceptedByIdAndFollowerId: jest.fn(),
		getMaxSortOrderForFriends: jest.fn(),
		shiftFriendSortOrders: jest.fn(),
		updateFollowSortOrder: jest.fn(),
		isMutualFriend: jest.fn(),
		countMutualFriends: jest.fn(),
		countReceivedRequests: jest.fn(),
		countSentRequests: jest.fn(),
		userExists: jest.fn(),
		getUserDisplayName: jest.fn(),
		findUserByTag: jest.fn(),
		getMutualFriendIds: jest.fn(),
	};
}

export function createFollowNotifierMock(): FollowNotifierPort {
	return {
		notifyFollowNew: jest.fn(),
		notifyFollowMutual: jest.fn(),
		notifyFirstFriendMilestone: jest.fn(),
	};
}

export function createFollowCacheMock(): FollowCachePort {
	return {
		getMutualFriend: jest.fn(),
		setMutualFriend: jest.fn(),
		invalidateMutualFriend: jest.fn(),
		wrapMutualFriendIds: jest.fn(),
		invalidateMutualFriendIds: jest.fn(),
		wrapFriendCount: jest.fn(),
		invalidateFriendCount: jest.fn(),
	};
}
