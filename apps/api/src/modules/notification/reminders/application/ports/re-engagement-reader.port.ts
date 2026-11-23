import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  FollowPairReadModel,
  FriendWithTodosReadModel,
  NudgeSuggestFollowReadModel,
  ActiveUserReadModel,
  OnboardingCandidateReadModel,
  SocialDigestCandidateReadModel,
  UserTodoCountReadModel,
  UserWithTodosAndStreakReadModel,
  WinbackUserReadModel,
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
  readonly recipientUserIds: readonly UserId[];
}

// Win-back·온보딩·넛지 추천·소셜 다이제스트·스트릭 위기 대상 조회
export abstract class ReEngagementReaderPort {
  /** 3~30일 미접속 사용자 */
  abstract listWinbackUsers(params: InactiveWindowParams): Promise<WinbackUserReadModel[]>;
  abstract listOnboardingCandidates(params: {
    timezones: readonly string[];
    createdSince: Temporal.Instant;
  }): Promise<OnboardingCandidateReadModel[]>;
  abstract countCompletedTodosByUsers(
    userIds: readonly UserId[],
  ): Promise<UserTodoCountReadModel[]>;
  abstract listActiveUsersInTimezones(timezones: readonly string[]): Promise<ActiveUserReadModel[]>;
  /** candidate들의 비활성 맞팔 친구 관계 */
  abstract listNudgeSuggestFollows(params: {
    candidateIds: readonly UserId[];
    activeSince: Temporal.Instant;
    activeUntil: Temporal.Instant;
  }): Promise<NudgeSuggestFollowReadModel[]>;
  /** 오늘 미완료 할 일이 있는 사용자 */
  abstract listSocialDigestCandidates(
    params: SocialDigestCandidateParams,
  ): Promise<SocialDigestCandidateReadModel[]>;
  abstract listAcceptedFollows(candidateIds: readonly UserId[]): Promise<FollowPairReadModel[]>;
  abstract listFriendsWithTodayTodos(params: {
    friendIds: readonly UserId[];
    today: Temporal.PlainDate;
    tomorrow: Temporal.PlainDate;
  }): Promise<FriendWithTodosReadModel[]>;
  /** 연속 기록 3일 이상이고 오늘 미완료 할 일이 있는 사용자 */
  abstract listStreakAtRiskUsers(
    params: TodayRangeParams,
  ): Promise<UserWithTodosAndStreakReadModel[]>;
}
