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
} from "../read-models/scheduler.read-model.js";

export interface InactiveWindowParams {
  readonly timezones: readonly string[];
  readonly inactiveSince: Temporal.Instant;
  readonly inactiveUntil: Temporal.Instant;
}

export interface TodayRangeParams {
  readonly timezones: readonly string[];
  readonly today: Temporal.PlainDate;
  readonly tomorrow: Temporal.PlainDate;
}

export interface SocialDigestCandidateParams extends TodayRangeParams {
  /** 직전 저녁 리마인더를 실제로 받은 사용자만 조회한다. */
  readonly recipientUserIds: readonly string[];
}

// Win-back·온보딩·넛지 추천·소셜 다이제스트·스트릭 위기 대상 조회
export abstract class ReEngagementReaderPort {
  /** 3~30일 미접속 사용자 */
  abstract findWinbackUsers(params: InactiveWindowParams): Promise<WinbackUser[]>;
  abstract findOnboardingCandidates(params: {
    timezones: readonly string[];
    createdSince: Temporal.Instant;
  }): Promise<OnboardingCandidate[]>;
  abstract countCompletedTodosByUsers(userIds: string[]): Promise<UserTodoCount[]>;
  abstract findActiveUsersInTimezones(timezones: readonly string[]): Promise<UserIdRow[]>;
  /** candidate들의 비활성 맞팔 친구 관계 */
  abstract findNudgeSuggestFollows(params: {
    candidateIds: string[];
    activeSince: Temporal.Instant;
    activeUntil: Temporal.Instant;
  }): Promise<NudgeSuggestFollow[]>;
  /** 오늘 미완료 할 일이 있는 사용자 */
  abstract findSocialDigestCandidates(
    params: SocialDigestCandidateParams,
  ): Promise<SocialDigestCandidate[]>;
  abstract findAcceptedFollows(candidateIds: string[]): Promise<FollowPair[]>;
  abstract findFriendsWithTodayTodos(params: {
    friendIds: string[];
    today: Temporal.PlainDate;
    tomorrow: Temporal.PlainDate;
  }): Promise<FriendWithTodos[]>;
  /** 연속 기록 3일 이상이고 오늘 미완료 할 일이 있는 사용자 */
  abstract findStreakAtRiskUsers(params: TodayRangeParams): Promise<UserWithTodosAndStreak[]>;
}
