/**
 * 공통 Prisma select 상수
 *
 * 여러 리포지토리에서 반복 사용되는 select shape을 공통화합니다.
 */

/**
 * 사용자 요약 정보 select (id, userTag, profile)
 *
 * 친구 목록, 응원/콕 등에서 사용자 정보를 표시할 때 사용합니다.
 */
export const USER_BRIEF_SELECT = {
	id: true,
	userTag: true,
	profile: {
		select: {
			name: true,
			profileImage: true,
		},
	},
} as const;
