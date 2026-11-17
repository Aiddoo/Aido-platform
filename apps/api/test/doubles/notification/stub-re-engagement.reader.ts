import {
  type InactiveWindowParams,
  ReEngagementReaderPort,
  type SocialDigestCandidateParams,
  type TodayRangeParams,
} from "#api/modules/notification/reminders/application/ports/re-engagement-reader.port";
import type {
  FollowPairReadModel,
  FriendWithTodosReadModel,
  NudgeSuggestFollowReadModel,
  OnboardingCandidateReadModel,
  SocialDigestCandidateReadModel,
  UserIdReadModel,
  UserTodoCountReadModel,
  UserWithTodosAndStreakReadModel,
  WinbackUserReadModel,
} from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";

export interface ReEngagementQuery {
  readonly method: keyof ReEngagementReaderPort;
  readonly params: unknown;
}

// 넣어 둔 대상을 주되 ID로 묻는 조회는 그 ID에 걸린 행만 준다. 기간·시간대 조건은 SQL이 맡는다
export class StubReEngagementReader extends ReEngagementReaderPort {
  winbackUsers: WinbackUserReadModel[] = [];
  onboardingCandidates: OnboardingCandidateReadModel[] = [];
  completedTodoCounts: UserTodoCountReadModel[] = [];
  activeUsers: UserIdReadModel[] = [];
  nudgeSuggestFollows: NudgeSuggestFollowReadModel[] = [];
  socialDigestCandidates: SocialDigestCandidateReadModel[] = [];
  acceptedFollows: FollowPairReadModel[] = [];
  friendsWithTodayTodos: FriendWithTodosReadModel[] = [];
  streakAtRiskUsers: UserWithTodosAndStreakReadModel[] = [];
  readonly queries: ReEngagementQuery[] = [];

  async findWinbackUsers(params: InactiveWindowParams): Promise<WinbackUserReadModel[]> {
    this.queries.push({ method: "findWinbackUsers", params });
    return this.winbackUsers;
  }

  async findOnboardingCandidates(params: {
    timezones: readonly string[];
    createdSince: Temporal.Instant;
  }): Promise<OnboardingCandidateReadModel[]> {
    this.queries.push({ method: "findOnboardingCandidates", params });
    return this.onboardingCandidates;
  }

  async countCompletedTodosByUsers(userIds: string[]): Promise<UserTodoCountReadModel[]> {
    this.queries.push({ method: "countCompletedTodosByUsers", params: [...userIds] });
    return this.completedTodoCounts.filter((row) => userIds.includes(row.userId));
  }

  async findActiveUsersInTimezones(timezones: readonly string[]): Promise<UserIdReadModel[]> {
    this.queries.push({ method: "findActiveUsersInTimezones", params: [...timezones] });
    return this.activeUsers;
  }

  async findNudgeSuggestFollows(params: {
    candidateIds: string[];
    activeSince: Temporal.Instant;
    activeUntil: Temporal.Instant;
  }): Promise<NudgeSuggestFollowReadModel[]> {
    this.queries.push({ method: "findNudgeSuggestFollows", params });
    return this.nudgeSuggestFollows.filter(
      (follow) =>
        params.candidateIds.includes(follow.followerId) ||
        params.candidateIds.includes(follow.followingId),
    );
  }

  async findSocialDigestCandidates(
    params: SocialDigestCandidateParams,
  ): Promise<SocialDigestCandidateReadModel[]> {
    this.queries.push({ method: "findSocialDigestCandidates", params });
    return this.socialDigestCandidates.filter((user) => params.recipientUserIds.includes(user.id));
  }

  async findAcceptedFollows(candidateIds: string[]): Promise<FollowPairReadModel[]> {
    this.queries.push({ method: "findAcceptedFollows", params: [...candidateIds] });
    return this.acceptedFollows.filter(
      (follow) =>
        candidateIds.includes(follow.followerId) || candidateIds.includes(follow.followingId),
    );
  }

  async findFriendsWithTodayTodos(params: {
    friendIds: string[];
    today: Temporal.PlainDate;
    tomorrow: Temporal.PlainDate;
  }): Promise<FriendWithTodosReadModel[]> {
    this.queries.push({ method: "findFriendsWithTodayTodos", params });
    return this.friendsWithTodayTodos.filter((friend) => params.friendIds.includes(friend.id));
  }

  async findStreakAtRiskUsers(
    params: TodayRangeParams,
  ): Promise<UserWithTodosAndStreakReadModel[]> {
    this.queries.push({ method: "findStreakAtRiskUsers", params });
    return this.streakAtRiskUsers;
  }

  queriedMethods(): Array<keyof ReEngagementReaderPort> {
    return this.queries.map(({ method }) => method);
  }
}
