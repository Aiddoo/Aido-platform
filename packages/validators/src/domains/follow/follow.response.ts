import { z } from 'zod';

import { datetimeSchema } from '../../common/datetime';

export const followStatusSchema = z.enum(['PENDING', 'ACCEPTED']);

export type FollowStatus = z.infer<typeof followStatusSchema>;

export const followSchema = z
  .object({
    id: z.cuid().describe('팔로우 관계 ID (CUID 25자, 예: clz7x5p8k0010qz0z8z8z8z8z)'),
    followerId: z.cuid().describe('팔로워 사용자 ID (CUID 25자)'),
    followingId: z.cuid().describe('팔로잉 대상 사용자 ID (CUID 25자)'),
    status: followStatusSchema.describe('친구 요청 상태 (PENDING | ACCEPTED)'),
    createdAt: datetimeSchema.describe('생성 시각 (ISO 8601 UTC, 예: 2026-01-15T10:30:00.000Z)'),
    updatedAt: datetimeSchema.describe('수정 시각 (ISO 8601 UTC, 예: 2026-01-15T10:35:00.000Z)'),
  })
  .meta({
    example: {
      id: 'clz7x5p8k0010qz0z8z8z8z8z',
      followerId: 'clz7x5p8k0001qz0z8z8z8z8z',
      followingId: 'clz7x5p8k0005qz0z8z8z8z8z',
      status: 'ACCEPTED',
      createdAt: '2026-01-15T10:30:00.000Z',
      updatedAt: '2026-01-15T10:35:00.000Z',
    },
  });

export type Follow = z.infer<typeof followSchema>;

export const followUserSchema = z
  .object({
    id: z.cuid().describe('사용자 ID (CUID 25자, 예: clz7x5p8k0005qz0z8z8z8z8z)'),
    userTag: z.string().length(8).describe('사용자 태그 (8자 영숫자 대문자, 예: JOHN2026)'),
    name: z.string().nullable().describe('사용자 이름 (미설정 시 null)'),
    profileImage: z.string().nullable().describe('프로필 이미지 URL (미설정 시 null)'),
    isFollowing: z.boolean().describe('내가 팔로우 중인지 여부'),
    isFollower: z.boolean().describe('상대가 나를 팔로우 중인지 여부'),
    isFriend: z.boolean().describe('서로 친구인지 여부 (양방향 팔로우)'),
    followedAt: datetimeSchema.describe(
      '팔로우 시작 시각 (ISO 8601 UTC, 예: 2026-01-15T10:30:00.000Z)',
    ),
  })
  .meta({
    example: {
      id: 'clz7x5p8k0005qz0z8z8z8z8z',
      userTag: 'JOHN2026',
      name: '존',
      profileImage: 'https://example.com/profiles/john.jpg',
      isFollowing: true,
      isFollower: true,
      isFriend: true,
      followedAt: '2026-01-15T10:30:00.000Z',
    },
  });

export type FollowUser = z.infer<typeof followUserSchema>;

export const friendUserSchema = z
  .object({
    followId: z.cuid().describe('팔로우 관계 ID (CUID 25자, 예: clz7x5p8k0010qz0z8z8z8z8z)'),
    id: z.cuid().describe('친구 사용자 ID (CUID 25자, 예: clz7x5p8k0005qz0z8z8z8z8z)'),
    userTag: z.string().length(8).describe('사용자 태그 (8자 영숫자 대문자, 예: JOHN2026)'),
    name: z.string().nullable().describe('사용자 이름 (미설정 시 null)'),
    profileImage: z.string().nullable().describe('프로필 이미지 URL (미설정 시 null)'),
    friendsSince: datetimeSchema.describe(
      '친구 맺은 시각 (ISO 8601 UTC, 예: 2026-01-15T10:35:00.000Z)',
    ),
  })
  .meta({
    example: {
      followId: 'clz7x5p8k0010qz0z8z8z8z8z',
      id: 'clz7x5p8k0005qz0z8z8z8z8z',
      userTag: 'JOHN2026',
      name: '존',
      profileImage: 'https://example.com/profiles/john.jpg',
      friendsSince: '2026-01-15T10:35:00.000Z',
    },
  });

export type FriendUser = z.infer<typeof friendUserSchema>;

export const friendRequestUserSchema = z
  .object({
    id: z.cuid().describe('사용자 ID (CUID 25자, 예: clz7x5p8k0005qz0z8z8z8z8z)'),
    userTag: z.string().length(8).describe('사용자 태그 (8자 영숫자 대문자, 예: JOHN2026)'),
    name: z.string().nullable().describe('사용자 이름 (미설정 시 null)'),
    profileImage: z.string().nullable().describe('프로필 이미지 URL (미설정 시 null)'),
    requestedAt: datetimeSchema.describe(
      '친구 요청 시각 (ISO 8601 UTC, 예: 2026-01-15T10:30:00.000Z)',
    ),
  })
  .meta({
    example: {
      id: 'clz7x5p8k0005qz0z8z8z8z8z',
      userTag: 'JOHN2026',
      name: '존',
      profileImage: 'https://example.com/profiles/john.jpg',
      requestedAt: '2026-01-15T10:30:00.000Z',
    },
  });

export type FriendRequestUser = z.infer<typeof friendRequestUserSchema>;

export const followingListResponseSchema = z
  .object({
    following: z.array(followUserSchema).describe('팔로잉 목록 (내가 팔로우하는 사용자들)'),
    totalCount: z.number().int().nonnegative().describe('전체 팔로잉 수 (음이 아닌 정수)'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .meta({
    example: {
      following: [
        {
          id: 'clz7x5p8k0005qz0z8z8z8z8z',
          userTag: 'JOHN2026',
          name: '존',
          profileImage: 'https://example.com/profiles/john.jpg',
          isFollowing: true,
          isFollower: true,
          isFriend: true,
          followedAt: '2026-01-15T10:30:00.000Z',
        },
      ],
      totalCount: 15,
      hasMore: true,
    },
  });

export type FollowingListResponse = z.infer<typeof followingListResponseSchema>;

export const followerListResponseSchema = z
  .object({
    followers: z.array(followUserSchema).describe('팔로워 목록 (나를 팔로우하는 사용자들)'),
    totalCount: z.number().int().nonnegative().describe('전체 팔로워 수 (음이 아닌 정수)'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .meta({
    example: {
      followers: [
        {
          id: 'clz7x5p8k0007qz0z8z8z8z8z',
          userTag: 'MIKE2025',
          name: '마이크',
          profileImage: 'https://example.com/profiles/mike.jpg',
          isFollowing: false,
          isFollower: true,
          isFriend: false,
          followedAt: '2026-01-12T14:00:00.000Z',
        },
      ],
      totalCount: 8,
      hasMore: false,
    },
  });

export type FollowerListResponse = z.infer<typeof followerListResponseSchema>;

export const friendsListResponseSchema = z
  .object({
    friends: z.array(friendUserSchema).describe('친구 목록 (서로 팔로우하는 사용자들)'),
    totalCount: z.number().int().nonnegative().describe('전체 친구 수 (음이 아닌 정수)'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .meta({
    example: {
      friends: [
        {
          followId: 'clz7x5p8k0010qz0z8z8z8z8z',
          id: 'clz7x5p8k0005qz0z8z8z8z8z',
          userTag: 'JOHN2026',
          name: '존',
          profileImage: 'https://example.com/profiles/john.jpg',
          friendsSince: '2026-01-15T10:35:00.000Z',
        },
      ],
      totalCount: 5,
      hasMore: false,
    },
  });

export type FriendsListResponse = z.infer<typeof friendsListResponseSchema>;

export const receivedRequestsResponseSchema = z
  .object({
    requests: z.array(friendRequestUserSchema).describe('받은 친구 요청 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 받은 요청 수 (음이 아닌 정수)'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .meta({
    example: {
      requests: [
        {
          id: 'clz7x5p8k0008qz0z8z8z8z8z',
          userTag: 'SARA2025',
          name: '사라',
          profileImage: 'https://example.com/profiles/sara.jpg',
          requestedAt: '2026-01-17T09:00:00.000Z',
        },
      ],
      totalCount: 3,
      hasMore: false,
    },
  });

export type ReceivedRequestsResponse = z.infer<typeof receivedRequestsResponseSchema>;

export const sentRequestsResponseSchema = z
  .object({
    requests: z.array(friendRequestUserSchema).describe('보낸 친구 요청 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 보낸 요청 수 (음이 아닌 정수)'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .meta({
    example: {
      requests: [
        {
          id: 'clz7x5p8k0009qz0z8z8z8z8z',
          userTag: 'ALEX2025',
          name: '알렉스',
          profileImage: 'https://example.com/profiles/alex.jpg',
          requestedAt: '2026-01-16T15:00:00.000Z',
        },
      ],
      totalCount: 2,
      hasMore: false,
    },
  });

export type SentRequestsResponse = z.infer<typeof sentRequestsResponseSchema>;

export const followCountResponseSchema = z
  .object({
    followingCount: z.number().int().nonnegative().describe('팔로잉 수 (음이 아닌 정수)'),
    followerCount: z.number().int().nonnegative().describe('팔로워 수 (음이 아닌 정수)'),
    friendCount: z.number().int().nonnegative().describe('친구 수 (음이 아닌 정수)'),
    pendingReceivedCount: z
      .number()
      .int()
      .nonnegative()
      .describe('받은 친구 요청 수 (음이 아닌 정수)'),
    pendingSentCount: z.number().int().nonnegative().describe('보낸 친구 요청 수 (음이 아닌 정수)'),
  })
  .meta({
    example: {
      followingCount: 15,
      followerCount: 8,
      friendCount: 5,
      pendingReceivedCount: 3,
      pendingSentCount: 2,
    },
  });

export type FollowCountResponse = z.infer<typeof followCountResponseSchema>;

export const sendFriendRequestResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    follow: followSchema.describe('생성된 팔로우 관계 정보'),
    autoAccepted: z.boolean().describe('자동 수락 여부 (상대방이 나를 먼저 팔로우했을 경우 true)'),
  })
  .meta({
    example: {
      message: '친구 요청을 보냈습니다.',
      follow: {
        id: 'clz7x5p8k0010qz0z8z8z8z8z',
        followerId: 'clz7x5p8k0001qz0z8z8z8z8z',
        followingId: 'clz7x5p8k0005qz0z8z8z8z8z',
        status: 'PENDING',
        createdAt: '2026-01-17T15:00:00.000Z',
        updatedAt: '2026-01-17T15:00:00.000Z',
      },
      autoAccepted: false,
    },
  });

export type SendFriendRequestResponse = z.infer<typeof sendFriendRequestResponseSchema>;

export const acceptFriendRequestResponseSchema = z
  .object({
    message: z.string(),
    friend: friendUserSchema,
  })
  .meta({
    example: {
      message: '친구 요청을 수락했습니다.',
      friend: {
        id: 'clz7x5p8k0008qz0z8z8z8z8z',
        userTag: 'SARA2025',
        name: '사라',
        profileImage: 'https://example.com/profiles/sara.jpg',
        friendsSince: '2026-01-17T15:30:00.000Z',
      },
    },
  });

export type AcceptFriendRequestResponse = z.infer<typeof acceptFriendRequestResponseSchema>;

export const rejectFriendRequestResponseSchema = z
  .object({
    message: z.string(),
  })
  .meta({
    example: {
      message: '친구 요청을 거절했습니다.',
    },
  });

export type RejectFriendRequestResponse = z.infer<typeof rejectFriendRequestResponseSchema>;

export const removeFriendResponseSchema = z
  .object({
    message: z.string(),
  })
  .meta({
    example: {
      message: '친구를 삭제했습니다.',
    },
  });

export type RemoveFriendResponse = z.infer<typeof removeFriendResponseSchema>;

export const cancelFriendRequestResponseSchema = z
  .object({
    message: z.string(),
  })
  .meta({
    example: {
      message: '친구 요청을 철회했습니다.',
    },
  });

export type CancelFriendRequestResponse = z.infer<typeof cancelFriendRequestResponseSchema>;

export const followResponseSchema = sendFriendRequestResponseSchema;
export type FollowResponse = z.infer<typeof followResponseSchema>;

export const unfollowResponseSchema = removeFriendResponseSchema;
export type UnfollowResponse = z.infer<typeof unfollowResponseSchema>;

export const removeFollowerResponseSchema = z
  .object({
    message: z.string(),
  })
  .meta({
    example: {
      message: '팔로워가 삭제되었습니다.',
    },
  });

export type RemoveFollowerResponse = z.infer<typeof removeFollowerResponseSchema>;
