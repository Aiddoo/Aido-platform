import type {
  FriendsListResponse,
  ReceivedRequestsResponse,
  ReorderFriendResponse,
  SearchUsersResponse,
  SendFriendRequestResponse,
  SentRequestsResponse,
} from '@aido/api';
import {
  acceptFriendRequestResponseSchema,
  friendsListResponseSchema,
  receivedRequestsResponseSchema,
  reorderFriendResponseSchema,
  searchUsersResponseSchema,
  sendFriendRequestResponseSchema,
  sentRequestsResponseSchema,
  type AcceptFriendRequestResponse,
} from '@aido/api';
import type { ErrorCodeType } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';

import {
  type FriendUser,
  friendUserSchema,
  type SearchedUser,
  searchedUserSchema,
} from '../domains/friend.model';

function generateSendFriendRequestDto(): SendFriendRequestResponse {
  return {
    message: '친구 요청을 보냈어요.',
    follow: {
      id: 'clz7x5p8k0010qz0z8z8z8z8z',
      followerId: 'clz7x5p8k0001qz0z8z8z8z8z',
      followingId: 'clz7x5p8k0005qz0z8z8z8z8z',
      status: 'PENDING',
      createdAt: '2026-01-17T15:00:00.000Z',
      updatedAt: '2026-01-17T15:00:00.000Z',
    },
    autoAccepted: false,
  };
}

export function createSendFriendRequestDto(
  overrides?: Partial<SendFriendRequestResponse>,
): SendFriendRequestResponse {
  return sendFriendRequestResponseSchema.parse({ ...generateSendFriendRequestDto(), ...overrides });
}

function generateAcceptFriendRequestDto(): AcceptFriendRequestResponse {
  return {
    message: '친구 요청을 수락했어요.',
    friend: {
      followId: 'clz7x5p8k0010qz0z8z8z8z8z',
      id: 'clz7x5p8k0005qz0z8z8z8z8z',
      userTag: 'JOHN2026',
      name: '존',
      profileImage: 'https://example.com/profiles/john.jpg',
      friendsSince: '2026-01-17T15:30:00.000Z',
    },
  };
}

export function createAcceptFriendRequestDto(
  overrides?: Partial<AcceptFriendRequestResponse>,
): AcceptFriendRequestResponse {
  return acceptFriendRequestResponseSchema.parse({
    ...generateAcceptFriendRequestDto(),
    ...overrides,
  });
}

function generateFriendsListDto(): FriendsListResponse {
  return {
    friends: [
      {
        id: 'clz7x5p8k0005qz0z8z8z8z8z',
        userTag: 'ABCD1234',
        name: '홍길동',
        profileImage: 'https://example.com/avatar1.jpg',
        followId: 'clz7x5p8k0010qz0z8z8z8z8z',
        friendsSince: '2026-01-15T00:00:00.000Z',
      },
      {
        id: 'clz7x5p8k0007qz0z8z8z8z8z',
        userTag: 'EFGH5678',
        name: null,
        profileImage: null,
        followId: 'clz7x5p8k0011qz0z8z8z8z8z',
        friendsSince: '2026-02-20T00:00:00.000Z',
      },
    ],
    totalCount: 2,
    hasMore: false,
  };
}

export function createFriendsListDto(
  overrides?: Partial<FriendsListResponse>,
): FriendsListResponse {
  return friendsListResponseSchema.parse({ ...generateFriendsListDto(), ...overrides });
}

function generateReceivedRequestsDto(): ReceivedRequestsResponse {
  return {
    requests: [
      {
        id: 'clz7x5p8k0008qz0z8z8z8z8z',
        userTag: 'IJKL9012',
        name: '김철수',
        profileImage: 'https://example.com/avatar3.jpg',
        requestedAt: '2026-03-01T10:00:00.000Z',
      },
    ],
    totalCount: 1,
    hasMore: false,
  };
}

export function createReceivedRequestsDto(
  overrides?: Partial<ReceivedRequestsResponse>,
): ReceivedRequestsResponse {
  return receivedRequestsResponseSchema.parse({ ...generateReceivedRequestsDto(), ...overrides });
}

function generateSentRequestsDto(): SentRequestsResponse {
  return {
    requests: [
      {
        id: 'clz7x5p8k0009qz0z8z8z8z8z',
        userTag: 'MNOP3456',
        name: '이영희',
        profileImage: null,
        requestedAt: '2026-03-02T14:00:00.000Z',
      },
    ],
    totalCount: 1,
    hasMore: false,
  };
}

export function createSentRequestsDto(
  overrides?: Partial<SentRequestsResponse>,
): SentRequestsResponse {
  return sentRequestsResponseSchema.parse({ ...generateSentRequestsDto(), ...overrides });
}

function generateReorderFriendDto(): ReorderFriendResponse {
  return {
    message: '친구 순서가 변경되었습니다.',
    friend: {
      followId: 'clz7x5p8k0010qz0z8z8z8z8z',
      id: 'clz7x5p8k0005qz0z8z8z8z8z',
      userTag: 'JOHN2026',
      name: '존',
      profileImage: 'https://example.com/profiles/john.jpg',
      friendsSince: '2026-01-15T10:35:00.000Z',
    },
  };
}

export function createReorderFriendDto(
  overrides?: Partial<ReorderFriendResponse>,
): ReorderFriendResponse {
  return reorderFriendResponseSchema.parse({ ...generateReorderFriendDto(), ...overrides });
}

function generateSearchUsersDto(): SearchUsersResponse {
  return {
    items: [
      // 추가 가능 (관계 없음)
      {
        id: 'clz7x5p8k0005qz0z8z8z8z8z',
        userTag: 'ABCD1234',
        name: '홍길동',
        profileImage: 'https://example.com/avatar1.jpg',
        isFollowing: false,
        isFollower: false,
        isFriend: false,
        requestPending: false,
      },
      // 요청 대기 중
      {
        id: 'clz7x5p8k0006qz0z8z8z8z8z',
        userTag: 'EFGH5678',
        name: '요청중이',
        profileImage: null,
        isFollowing: false,
        isFollower: false,
        isFriend: false,
        requestPending: true,
      },
      // 이미 친구
      {
        id: 'clz7x5p8k0007qz0z8z8z8z8z',
        userTag: 'IJKL9012',
        name: '내친구',
        profileImage: null,
        isFollowing: true,
        isFollower: true,
        isFriend: true,
        requestPending: false,
      },
      // 동명이인 (첫 번째 홍길동과 이름 동일, 태그 다름)
      {
        id: 'clz7x5p8k0008qz0z8z8z8z8z',
        userTag: 'MNOP3456',
        name: '홍길동',
        profileImage: null,
        isFollowing: false,
        isFollower: false,
        isFriend: false,
        requestPending: false,
      },
    ],
    totalCount: 4,
    hasMore: false,
    nextCursor: null,
  };
}

export function createSearchUsersDto(
  overrides?: Partial<SearchUsersResponse>,
): SearchUsersResponse {
  return searchUsersResponseSchema.parse({ ...generateSearchUsersDto(), ...overrides });
}

export function createFriendApiError(
  overrides?: Partial<{ code: ErrorCodeType; message: string; status: number }>,
) {
  return new ApiError(
    overrides?.code ?? 'FOLLOW_0901',
    overrides?.message ?? '자기 자신에게 친구 요청을 보낼 수 없어요',
    overrides?.status ?? 400,
  );
}

export function createFriendUser(id: string, overrides?: Partial<FriendUser>): FriendUser {
  return friendUserSchema.parse({
    id,
    followId: `follow-${id}`,
    userTag: 'ABCD1234',
    name: '친구',
    profileImage: null,
    friendsSince: '2026-10-03T00:00:00.000Z',
    ...overrides,
  });
}

export function createSearchedUser(overrides?: Partial<SearchedUser>): SearchedUser {
  return searchedUserSchema.parse({
    id: 'clz7x5p8k0005qz0z8z8z8z8z',
    userTag: 'ABCD1234',
    name: '홍길동',
    profileImage: null,
    isFriend: false,
    requestPending: false,
    ...overrides,
  });
}
