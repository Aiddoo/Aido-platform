/**
 * 재유입(re-engagement) 알림 대상 조회 포트.
 *
 * Win-back·온보딩·넛지 추천·소셜 다이제스트·스트릭 위기 전략의 데이터 접근을 담당한다.
 */
import type {
	FollowPair,
	FriendWithTodos,
	NudgeSuggestFollow,
	OnboardingCandidate,
	SocialDigestCandidate,
	UserIdRow,
	UserTodoCount,
	UserWithTodosAndStreak,
	WinbackUser,
} from "./scheduler-read-models";

export const RE_ENGAGEMENT_READER = Symbol("RE_ENGAGEMENT_READER");

/** 미접속 구간 조회 파라미터 */
export interface InactiveWindowParams {
	readonly tz: string;
	readonly inactiveSince: Date;
	readonly inactiveUntil: Date;
}

/** 오늘 범위 조회 파라미터 */
export interface TodayRangeParams {
	readonly tz: string;
	readonly today: Date;
	readonly tomorrow: Date;
}

export interface SocialDigestCandidateParams extends TodayRangeParams {
	/** 직전 저녁 리마인더를 실제로 받은 사용자만 조회한다. */
	readonly recipientUserIds: readonly string[];
}

export interface ReEngagementReaderPort {
	/** Win-back 대상: 3~30일 미접속 유저 */
	findWinbackUsers(params: InactiveWindowParams): Promise<WinbackUser[]>;

	/** 온보딩 대상: 가입 후 cutoff 이내 유저 */
	findOnboardingCandidates(params: {
		tz: string;
		createdSince: Date;
	}): Promise<OnboardingCandidate[]>;

	/** 유저별 완료 투두 수 (온보딩 day 5·7용) */
	countCompletedTodosByUsers(userIds: string[]): Promise<UserTodoCount[]>;

	/** 넛지 추천: 타임존 내 활성(미삭제) 유저 목록 */
	findActiveUsersInTimezone(tz: string): Promise<UserIdRow[]>;

	/** 넛지 추천: candidate들의 비활성 맞팔 친구 관계 */
	findNudgeSuggestFollows(params: {
		candidateIds: string[];
		activeSince: Date;
		activeUntil: Date;
	}): Promise<NudgeSuggestFollow[]>;

	/** 소셜 다이제스트 후보: 오늘 미완료 투두 보유 유저 */
	findSocialDigestCandidates(params: SocialDigestCandidateParams): Promise<SocialDigestCandidate[]>;

	/** candidate들의 ACCEPTED 맞팔 관계 ID 쌍 */
	findAcceptedFollows(candidateIds: string[]): Promise<FollowPair[]>;

	/** 친구들의 오늘 투두 완료 현황 */
	findFriendsWithTodayTodos(params: {
		friendIds: string[];
		today: Date;
		tomorrow: Date;
	}): Promise<FriendWithTodos[]>;

	/** 스트릭 위기 대상: 스트릭 3일+ & 오늘 미완료 투두 보유 유저 */
	findStreakAtRiskUsers(params: TodayRangeParams): Promise<UserWithTodosAndStreak[]>;
}
