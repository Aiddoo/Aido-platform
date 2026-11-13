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
import { pick } from 'es-toolkit';

import type {
  FriendRequest,
  FriendRequestPage,
  FriendUser,
  FriendUserPage,
  SearchedUser,
  SearchedUserPage,
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

// 친구·요청 목록은 마지막 항목의 id가 다음 커서다
export function toFriendsPage(dto: FriendsListResponse): FriendUserPage {
  const items = dto.friends.map(toFriendUser);
  return {
    items,
    nextCursor: dto.hasMore ? (items.at(-1)?.followId ?? null) : null,
    totalCount: dto.totalCount,
  };
}

// 받은 요청과 보낸 요청은 응답 모양이 같다
export function toFriendRequestsPage(dto: ReceivedRequestsResponse): FriendRequestPage {
  const items = dto.requests.map(toFriendRequest);
  return {
    items,
    nextCursor: dto.hasMore ? (items.at(-1)?.id ?? null) : null,
    totalCount: dto.totalCount,
  };
}

// 검색은 관련도 순이라 id로 이을 수 없어 서버가 준 커서를 쓴다
export function toSearchedUsersPage(dto: SearchUsersResponse): SearchedUserPage {
  return {
    items: dto.items.map(toSearchedUser),
    nextCursor: dto.hasMore ? dto.nextCursor : null,
  };
}

export function toSendFriendRequestResult(dto: SendFriendRequestResponse): SendFriendRequestResult {
  return pick(dto, ['autoAccepted']);
}
