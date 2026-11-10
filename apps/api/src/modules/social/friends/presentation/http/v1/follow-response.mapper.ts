import type {
  AcceptFriendRequestResponse,
  Follow as FollowResponse,
  FriendRequestUser,
  FriendsListResponse,
  FriendUser,
  ReceivedRequestsResponse,
  ReorderFriendResponse,
  SearchUser,
  SearchUsersResponse,
  SendFriendRequestResponse,
  SentRequestsResponse,
} from "@aido/api/contracts/follow";

import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";
import { toIsoString } from "#api/shared/domain/time/instant";

import type {
  FriendReadModel,
  FriendRequestReadModel,
} from "../../../application/read-models/friend.read-model.js";
import type { UserSearchResultReadModel } from "../../../application/read-models/user-search-result.read-model.js";
import type { GetFriendsResult } from "../../../application/use-cases/get-friends.use-case.js";
import type { GetReceivedFriendRequestsResult } from "../../../application/use-cases/get-received-friend-requests.use-case.js";
import type { GetSentFriendRequestsResult } from "../../../application/use-cases/get-sent-friend-requests.use-case.js";
import type { SearchUsersResult } from "../../../application/use-cases/search-users.use-case.js";
import type { SendFriendRequestResult } from "../../../application/use-cases/send-friend-request.use-case.js";
import type { Friendship } from "../../../domain/friendship.aggregate.js";

export const FOLLOW_RESPONSE_MESSAGES = {
  REQUEST_SENT: "친구 요청을 보냈습니다.",
  BECAME_FRIENDS: "친구가 되었습니다.",
  REQUEST_ACCEPTED: "친구 요청을 수락했습니다.",
  REQUEST_REJECTED: "친구 요청을 거절했습니다.",
  REMOVED: "친구를 삭제했습니다.",
  REORDERED: "친구 순서가 변경되었습니다.",
} as const;

function toFollowResponse(friendship: Friendship): FollowResponse {
  const primitives = friendship.toPrimitives();
  return {
    id: primitives.id,
    followerId: primitives.followerId,
    followingId: primitives.followingId,
    status: primitives.status,
    createdAt: toIsoString(primitives.createdAt),
    updatedAt: toIsoString(primitives.updatedAt),
  };
}

function toFriendUserResponse(friend: FriendReadModel, appVersion?: string): FriendUser {
  return {
    followId: friend.friendshipId,
    id: friend.user.id,
    userTag: friend.user.userTag,
    name: friend.user.name,
    profileImage: resolveProfileImage(friend.user.profileImage, appVersion),
    friendsSince: toIsoString(friend.friendsSince),
  };
}

function toFriendRequestUserResponse(
  request: FriendRequestReadModel,
  appVersion?: string,
): FriendRequestUser {
  return {
    id: request.user.id,
    userTag: request.user.userTag,
    name: request.user.name,
    profileImage: resolveProfileImage(request.user.profileImage, appVersion),
    requestedAt: toIsoString(request.requestedAt),
  };
}

function toSearchUserResponse(result: UserSearchResultReadModel, appVersion?: string): SearchUser {
  return {
    id: result.user.id,
    userTag: result.user.userTag,
    name: result.user.name,
    profileImage: resolveProfileImage(result.user.profileImage, appVersion),
    isFollowing: result.isFollowing,
    isFollower: result.isFollower,
    isFriend: result.isFriend,
    requestPending: result.isRequestPending,
  };
}

export function toSendFriendRequestResponse(
  result: SendFriendRequestResult,
): SendFriendRequestResponse {
  return {
    message: result.isAutoAccepted
      ? FOLLOW_RESPONSE_MESSAGES.BECAME_FRIENDS
      : FOLLOW_RESPONSE_MESSAGES.REQUEST_SENT,
    follow: toFollowResponse(result.friendship),
    autoAccepted: result.isAutoAccepted,
  };
}

export function toAcceptFriendRequestResponse(
  friend: FriendReadModel,
  appVersion?: string,
): AcceptFriendRequestResponse {
  return {
    message: FOLLOW_RESPONSE_MESSAGES.REQUEST_ACCEPTED,
    friend: toFriendUserResponse(friend, appVersion),
  };
}

export function toReorderFriendResponse(
  friend: FriendReadModel,
  appVersion?: string,
): ReorderFriendResponse {
  return {
    message: FOLLOW_RESPONSE_MESSAGES.REORDERED,
    friend: toFriendUserResponse(friend, appVersion),
  };
}

// 친구·요청 목록은 출시 계약이 { 목록, totalCount, hasMore } 모양이다
export function toFriendsListResponse(
  result: GetFriendsResult,
  appVersion?: string,
): FriendsListResponse {
  return {
    friends: result.page.items.map((friend) => toFriendUserResponse(friend, appVersion)),
    totalCount: result.totalCount,
    hasMore: result.page.pagination.hasNext,
  };
}

export function toReceivedRequestsResponse(
  result: GetReceivedFriendRequestsResult,
  appVersion?: string,
): ReceivedRequestsResponse {
  return {
    requests: result.page.items.map((request) => toFriendRequestUserResponse(request, appVersion)),
    totalCount: result.totalCount,
    hasMore: result.page.pagination.hasNext,
  };
}

export function toSentRequestsResponse(
  result: GetSentFriendRequestsResult,
  appVersion?: string,
): SentRequestsResponse {
  return {
    requests: result.page.items.map((request) => toFriendRequestUserResponse(request, appVersion)),
    totalCount: result.totalCount,
    hasMore: result.page.pagination.hasNext,
  };
}

export function toSearchUsersResponse(
  result: SearchUsersResult,
  appVersion?: string,
): SearchUsersResponse {
  return {
    items: result.page.items.map((item) => toSearchUserResponse(item, appVersion)),
    totalCount: result.totalCount,
    hasMore: result.page.pagination.hasNext,
    nextCursor: result.page.pagination.nextCursor,
  };
}
