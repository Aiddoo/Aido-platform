/**
 * Follow Response 스키마
 *
 * 팔로우 관련 응답 검증을 위한 Zod 스키마
 */
import { z } from 'zod';
import { datetimeSchema } from '../../common/datetime';

// ============================================
// 팔로우 엔티티
// ============================================

/** 팔로우 관계 스키마 */
export const followSchema = z
  .object({
    id: z.string().cuid().describe('팔로우 관계 고유 ID'),
    followerId: z.string().cuid().describe('팔로우하는 사용자 ID'),
    followingId: z.string().cuid().describe('팔로우 당하는 사용자 ID'),
    createdAt: datetimeSchema.describe('팔로우 시작 시각'),
  })
  .describe('팔로우 관계 정보')
  .meta({
    example: {
      id: 'clz7x5p8k0010qz0z8z8z8z8z',
      followerId: 'clz7x5p8k0001qz0z8z8z8z8z',
      followingId: 'clz7x5p8k0005qz0z8z8z8z8z',
      createdAt: '2026-01-15T10:30:00.000Z',
    },
  });

export type Follow = z.infer<typeof followSchema>;

// ============================================
// 팔로우 사용자 정보
// ============================================

/** 팔로우/팔로워 목록에서 보여줄 사용자 정보 */
export const followUserSchema = z
  .object({
    id: z.string().cuid().describe('사용자 ID'),
    userTag: z.string().length(8).describe('사용자 태그 (8자리 영숫자)'),
    name: z.string().nullable().describe('사용자 이름'),
    profileImage: z.string().nullable().describe('프로필 이미지 URL'),
    isFollowing: z.boolean().describe('내가 이 사용자를 팔로우하는지'),
    isFollower: z.boolean().describe('이 사용자가 나를 팔로우하는지'),
    followedAt: datetimeSchema.describe('팔로우 시작 시각'),
  })
  .describe('팔로우 관계의 사용자 정보')
  .meta({
    example: {
      id: 'clz7x5p8k0005qz0z8z8z8z8z',
      userTag: 'JOHN2026',
      name: '존',
      profileImage: 'https://example.com/profiles/john.jpg',
      isFollowing: true,
      isFollower: false,
      followedAt: '2026-01-15T10:30:00.000Z',
    },
  });

export type FollowUser = z.infer<typeof followUserSchema>;

// ============================================
// 팔로우 목록 응답
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
          isFollower: false,
          followedAt: '2026-01-15T10:30:00.000Z',
        },
        {
          id: 'clz7x5p8k0006qz0z8z8z8z8z',
          userTag: 'JANE2025',
          name: '제인',
          profileImage: 'https://example.com/profiles/jane.jpg',
          isFollowing: true,
          isFollower: true,
          followedAt: '2026-01-10T09:00:00.000Z',
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
          followedAt: '2026-01-12T14:00:00.000Z',
        },
      ],
      totalCount: 8,
      hasMore: false,
    },
  });

export type FollowerListResponse = z.infer<typeof followerListResponseSchema>;

// ============================================
// 팔로우 카운트 응답
// ============================================

/** 팔로우 통계 응답 */
export const followCountResponseSchema = z
  .object({
    followingCount: z.number().int().nonnegative().describe('팔로잉 수'),
    followerCount: z.number().int().nonnegative().describe('팔로워 수'),
  })
  .describe('팔로우 통계')
  .meta({
    example: {
      followingCount: 15,
      followerCount: 8,
    },
  });

export type FollowCountResponse = z.infer<typeof followCountResponseSchema>;

// ============================================
// 팔로우 액션 응답
// ============================================

/** 팔로우 성공 응답 */
export const followResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
    follow: followSchema.describe('생성된 팔로우 관계'),
  })
  .describe('팔로우 성공 응답')
  .meta({
    example: {
      message: '팔로우되었습니다.',
      follow: {
        id: 'clz7x5p8k0010qz0z8z8z8z8z',
        followerId: 'clz7x5p8k0001qz0z8z8z8z8z',
        followingId: 'clz7x5p8k0005qz0z8z8z8z8z',
        createdAt: '2026-01-17T15:00:00.000Z',
      },
    },
  });

export type FollowResponse = z.infer<typeof followResponseSchema>;

/** 언팔로우 성공 응답 */
export const unfollowResponseSchema = z
  .object({
    message: z.string().describe('응답 메시지'),
  })
  .describe('언팔로우 성공 응답')
  .meta({
    example: {
      message: '언팔로우되었습니다.',
    },
  });

export type UnfollowResponse = z.infer<typeof unfollowResponseSchema>;

/** 팔로워 삭제 성공 응답 */
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
