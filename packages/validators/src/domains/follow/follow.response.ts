/**
 * Follow Response 스키마
 *
 * 친구 요청 시스템 응답 검증을 위한 Zod 스키마
 */
import { z } from 'zod';

// ============================================
// 친구 요청 상태 Enum
// ============================================

/** 친구 요청 상태 */
export const followStatusSchema = z.enum(['PENDING', 'ACCEPTED']).describe('친구 요청 상태');

export type FollowStatus = z.infer<typeof followStatusSchema>;

// ============================================
// 팔로우 엔티티
// ============================================

/** 팔로우 관계 스키마 */
export const followSchema = z
  .object({
    id: z.string().cuid().describe('팔로우 관계 고유 ID'),
    followerId: z.string().cuid().describe('친구 요청을 보낸 사용자 ID'),
    followingId: z.string().cuid().describe('친구 요청을 받은 사용자 ID'),
    status: followStatusSchema.describe('친구 요청 상태'),
    createdAt: z.string().datetime().describe('친구 요청 시각'),
    updatedAt: z.string().datetime().describe('마지막 업데이트 시각'),
  })
  .describe('팔로우 관계 정보')
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

// ============================================
// 친구/팔로우 사용자 정보
// ============================================

/** 친구/팔로워 목록에서 보여줄 사용자 정보 */
export const followUserSchema = z
  .object({
    id: z.string().cuid().describe('사용자 ID'),
    userTag: z.string().length(8).describe('사용자 태그 (8자리 영숫자)'),
    name: z.string().nullable().describe('사용자 이름'),
    profileImage: z.string().nullable().describe('프로필 이미지 URL'),
    isFollowing: z.boolean().describe('내가 이 사용자에게 친구 요청을 보냈거나 친구인지'),
    isFollower: z.boolean().describe('이 사용자가 나에게 친구 요청을 보냈거나 친구인지'),
    isFriend: z.boolean().describe('서로 친구인지 (맞팔 성립)'),
    followedAt: z.string().datetime().describe('친구 요청 시각'),
  })
  .describe('팔로우 관계의 사용자 정보')
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

/** 친구 목록에서 보여줄 사용자 정보 (간소화) */
export const friendUserSchema = z
  .object({
    followId: z.string().cuid().describe('팔로우 관계 ID (페이지네이션 커서용)'),
    id: z.string().cuid().describe('사용자 ID'),
    userTag: z.string().length(8).describe('사용자 태그 (8자리 영숫자)'),
    name: z.string().nullable().describe('사용자 이름'),
    profileImage: z.string().nullable().describe('프로필 이미지 URL'),
    friendsSince: z.string().datetime().describe('친구가 된 시각'),
  })
  .describe('친구 사용자 정보')
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

/** 친구 요청 목록에서 보여줄 사용자 정보 */
export const friendRequestUserSchema = z
  .object({
    id: z.string().cuid().describe('사용자 ID'),
    userTag: z.string().length(8).describe('사용자 태그 (8자리 영숫자)'),
    name: z.string().nullable().describe('사용자 이름'),
    profileImage: z.string().nullable().describe('프로필 이미지 URL'),
    requestedAt: z.string().datetime().describe('친구 요청 시각'),
  })
  .describe('친구 요청 사용자 정보')
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

// ============================================
// 팔로우 목록 응답 (레거시 호환)
// ============================================

/** 팔로잉 목록 응답 */
export const followingListResponseSchema = z
  .object({
    following: z.array(followUserSchema).describe('팔로잉 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 팔로잉 수'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .describe('팔로잉 목록 응답')
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

/** 팔로워 목록 응답 */
export const followerListResponseSchema = z
  .object({
    followers: z.array(followUserSchema).describe('팔로워 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 팔로워 수'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .describe('팔로워 목록 응답')
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

// ============================================
// 친구 목록 응답
// ============================================

/** 친구 목록 응답 (맞팔 성립) */
export const friendsListResponseSchema = z
  .object({
    friends: z.array(friendUserSchema).describe('친구 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 친구 수'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .describe('친구 목록 응답')
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

// ============================================
// 친구 요청 목록 응답
// ============================================

/** 받은 친구 요청 목록 응답 */
export const receivedRequestsResponseSchema = z
  .object({
    requests: z.array(friendRequestUserSchema).describe('받은 친구 요청 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 요청 수'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .describe('받은 친구 요청 목록 응답')
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

/** 보낸 친구 요청 목록 응답 */
export const sentRequestsResponseSchema = z
  .object({
    requests: z.array(friendRequestUserSchema).describe('보낸 친구 요청 목록'),
    totalCount: z.number().int().nonnegative().describe('전체 요청 수'),
    hasMore: z.boolean().describe('다음 페이지 존재 여부'),
  })
  .describe('보낸 친구 요청 목록 응답')
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

// ============================================
// 팔로우 카운트 응답
// ============================================

/** 팔로우 통계 응답 */
export const followCountResponseSchema = z
  .object({
    followingCount: z.number().int().nonnegative().describe('팔로잉 수'),
    followerCount: z.number().int().nonnegative().describe('팔로워 수'),
    friendCount: z.number().int().nonnegative().describe('친구 수 (맞팔)'),
    pendingReceivedCount: z.number().int().nonnegative().describe('받은 친구 요청 수'),
    pendingSentCount: z.number().int().nonnegative().describe('보낸 친구 요청 수'),
  })
  .describe('팔로우 통계')
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

// ============================================
// 친구 요청 액션 응답
// ============================================

/** 친구 요청 보내기 성공 응답 */
export const sendFriendRequestResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    follow: followSchema.describe('생성된 친구 요청'),
    autoAccepted: z.boolean().describe('자동 수락 여부 (상대방이 먼저 요청한 경우 true)'),
  })
  .describe('친구 요청 보내기 성공 응답')
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

/** 친구 요청 수락 성공 응답 */
export const acceptFriendRequestResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    friend: friendUserSchema.describe('새로운 친구 정보'),
  })
  .describe('친구 요청 수락 성공 응답')
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

/** 친구 요청 거절 성공 응답 */
export const rejectFriendRequestResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .describe('친구 요청 거절 성공 응답')
  .meta({
    example: {
      message: '친구 요청을 거절했습니다.',
    },
  });

export type RejectFriendRequestResponse = z.infer<typeof rejectFriendRequestResponseSchema>;

/** 친구 삭제 성공 응답 */
export const removeFriendResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .describe('친구 삭제 성공 응답')
  .meta({
    example: {
      message: '친구를 삭제했습니다.',
    },
  });

export type RemoveFriendResponse = z.infer<typeof removeFriendResponseSchema>;

/** 친구 요청 철회 성공 응답 */
export const cancelFriendRequestResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .describe('친구 요청 철회 성공 응답')
  .meta({
    example: {
      message: '친구 요청을 철회했습니다.',
    },
  });

export type CancelFriendRequestResponse = z.infer<typeof cancelFriendRequestResponseSchema>;

// ============================================
// 레거시 호환 (기존 API 유지)
// ============================================

/** 팔로우 성공 응답 (레거시) */
export const followResponseSchema = sendFriendRequestResponseSchema;
export type FollowResponse = z.infer<typeof followResponseSchema>;

/** 언팔로우 성공 응답 (레거시) */
export const unfollowResponseSchema = removeFriendResponseSchema;
export type UnfollowResponse = z.infer<typeof unfollowResponseSchema>;

/** 팔로워 삭제 성공 응답 (레거시) */
export const removeFollowerResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .describe('팔로워 삭제 성공 응답')
  .meta({
    example: {
      message: '팔로워가 삭제되었습니다.',
    },
  });

export type RemoveFollowerResponse = z.infer<typeof removeFollowerResponseSchema>;
