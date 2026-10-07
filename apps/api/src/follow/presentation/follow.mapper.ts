import type { Follow, FriendRequestUser, FriendUser, SearchUser } from "@aido/validators";
/**
 * Follow 프레젠테이션 매퍼
 *
 * 애플리케이션 타입(FollowRecord/FollowWithUser)을 API 응답(@aido/validators) 형식으로
 * 변환하는 Static 메서드를 제공한다. 필드·직렬화 규칙은 레거시와 동일하다(계약 불변).
 */

import { toISOString } from "#api/shared/domain/date/utils/format";
import { resolveProfileImage } from "#api/shared/presentation/profile/profile-image.resolver";

import type {
  FollowWithUser,
  UserSearchResult,
} from "../application/ports/follow.repository.port.js";
import type { Friendship } from "../domain/entities/friendship.aggregate.js";

export abstract class FollowMapper {
  /** Friendship 애그리게잇을 기본 응답 형식으로 변환 */
  static toResponse(entity: Friendship): Follow {
    return {
      id: entity.id,
      followerId: entity.followerId,
      followingId: entity.followingId,
      status: entity.status,
      createdAt: toISOString(entity.createdAt),
      updatedAt: toISOString(entity.updatedAt),
    };
  }

  /**
   * FollowWithUser를 친구 정보로 변환.
   * following이 항상 친구(상대방)이다.
   */
  static toFriendUser(follow: FollowWithUser, appVersion?: string): FriendUser {
    const friend = follow.following;
    return {
      followId: follow.id,
      id: friend.id,
      userTag: friend.userTag,
      name: friend.profile?.name ?? null,
      profileImage: resolveProfileImage(friend.profile?.profileImage ?? null, appVersion),
      friendsSince: toISOString(follow.updatedAt),
    };
  }

  /** 받은 친구 요청 변환 (follower가 요청자) */
  static toReceivedRequest(follow: FollowWithUser, appVersion?: string): FriendRequestUser {
    const requester = follow.follower;
    return {
      id: requester.id,
      userTag: requester.userTag,
      name: requester.profile?.name ?? null,
      profileImage: resolveProfileImage(requester.profile?.profileImage ?? null, appVersion),
      requestedAt: toISOString(follow.createdAt),
    };
  }

  /** 보낸 친구 요청 변환 (following이 수신자) */
  static toSentRequest(follow: FollowWithUser, appVersion?: string): FriendRequestUser {
    const recipient = follow.following;
    return {
      id: recipient.id,
      userTag: recipient.userTag,
      name: recipient.profile?.name ?? null,
      profileImage: resolveProfileImage(recipient.profile?.profileImage ?? null, appVersion),
      requestedAt: toISOString(follow.createdAt),
    };
  }

  /** 사용자 검색 결과 변환 (내부 rank는 드롭, 관계 flag 전달) */
  static toSearchUser(result: UserSearchResult, appVersion?: string): SearchUser {
    return {
      id: result.id,
      userTag: result.userTag,
      name: result.profile?.name ?? null,
      profileImage: resolveProfileImage(result.profile?.profileImage ?? null, appVersion),
      isFollowing: result.isFollowing,
      isFollower: result.isFollower,
      isFriend: result.isFriend,
      requestPending: result.requestPending,
    };
  }
}
