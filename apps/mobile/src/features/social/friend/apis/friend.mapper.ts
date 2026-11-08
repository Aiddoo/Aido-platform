import type {
  FriendRequestUser,
  FriendsListResponse,
  FriendUser as FriendUserDto,
  ReceivedRequestsResponse,
  SearchUser,
  SearchUsersResponse,
  SendFriendRequestResponse,
} from '@aido/api';
import { toInstant } from '@src/shared/date/instant';
import type { Page } from '@src/shared/types/page.types';
import { pick } from 'es-toolkit';

import type {
  FriendRequest,
  FriendUser,
  SearchedUser,
  SendFriendRequestResult,
} from '../domains/friend.model';

export function toFriendUser(dto: FriendUserDto): FriendUser {
  return {
    ...pick(dto, ['id', 'followId', 'userTag', 'name', 'profileImage']),
    friendsSince: toInstant(dto.friendsSince),
  };
}

function toFriendRequest(dto: FriendRequestUser): FriendRequest {
  return {
    ...pick(dto, ['id', 'userTag', 'name', 'profileImage']),
    requestedAt: toInstant(dto.requestedAt),
  };
}

function toSearchedUser(dto: SearchUser): SearchedUser {
  return pick(dto, ['id', 'userTag', 'name', 'profileImage', 'isFriend', 'requestPending']);
}

export function toFriendsPage(dto: FriendsListResponse): Page<FriendUser> {
  return {
    items: dto.friends.map(toFriendUser),
    totalCount: dto.totalCount,
    hasMore: dto.hasMore,
  };
}

// 받은 요청과 보낸 요청은 응답 모양이 같다
export function toFriendRequestsPage(dto: ReceivedRequestsResponse): Page<FriendRequest> {
  return {
    items: dto.requests.map(toFriendRequest),
    totalCount: dto.totalCount,
    hasMore: dto.hasMore,
  };
}

export function toSearchedUsersPage(dto: SearchUsersResponse): Page<SearchedUser> {
  return {
    items: dto.items.map(toSearchedUser),
    totalCount: dto.totalCount,
    hasMore: dto.hasMore,
    nextCursor: dto.nextCursor,
  };
}

export function toSendFriendRequestResult(dto: SendFriendRequestResponse): SendFriendRequestResult {
  return pick(dto, ['autoAccepted']);
}
