import {
  type InactiveWindowParams,
  ReEngagementReaderPort,
  type SocialDigestCandidateParams,
  type TodayRangeParams,
} from "#api/modules/notification/reminders/application/ports/re-engagement-reader.port";
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
} from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";

export interface ReEngagementQuery {
  readonly method: keyof ReEngagementReaderPort;
  readonly params: unknown;
}

// 넣어 둔 대상을 주되 ID로 묻는 조회는 그 ID에 걸린 행만 준다. 기간·시간대 조건은 SQL이 맡는다
export class StubReEngagementReader extends ReEngagementReaderPort {
  winbackUsers: WinbackUser[] = [];
  onboardingCandidates: OnboardingCandidate[] = [];
  completedTodoCounts: UserTodoCount[] = [];
  activeUsers: UserIdRow[] = [];
  nudgeSuggestFollows: NudgeSuggestFollow[] = [];
  socialDigestCandidates: SocialDigestCandidate[] = [];
  acceptedFollows: FollowPair[] = [];
  friendsWithTodayTodos: FriendWithTodos[] = [];
  streakAtRiskUsers: UserWithTodosAndStreak[] = [];
  readonly queries: ReEngagementQuery[] = [];

  async findWinbackUsers(params: InactiveWindowParams): Promise<WinbackUser[]> {
    this.queries.push({ method: "findWinbackUsers", params });
    return this.winbackUsers;
  }

  async findOnboardingCandidates(params: {
    timezones: readonly string[];
    createdSince: Temporal.Instant;
  }): Promise<OnboardingCandidate[]> {
    this.queries.push({ method: "findOnboardingCandidates", params });
    return this.onboardingCandidates;
  }

  async countCompletedTodosByUsers(userIds: string[]): Promise<UserTodoCount[]> {
    this.queries.push({ method: "countCompletedTodosByUsers", params: [...userIds] });
    return this.completedTodoCounts.filter((row) => userIds.includes(row.userId));
  }

  async findActiveUsersInTimezones(timezones: readonly string[]): Promise<UserIdRow[]> {
    this.queries.push({ method: "findActiveUsersInTimezones", params: [...timezones] });
    return this.activeUsers;
  }

  async findNudgeSuggestFollows(params: {
    candidateIds: string[];
    activeSince: Temporal.Instant;
    activeUntil: Temporal.Instant;
  }): Promise<NudgeSuggestFollow[]> {
    this.queries.push({ method: "findNudgeSuggestFollows", params });
    return this.nudgeSuggestFollows.filter(
      (follow) =>
        params.candidateIds.includes(follow.followerId) ||
        params.candidateIds.includes(follow.followingId),
    );
  }

  async findSocialDigestCandidates(
    params: SocialDigestCandidateParams,
  ): Promise<SocialDigestCandidate[]> {
    this.queries.push({ method: "findSocialDigestCandidates", params });
    return this.socialDigestCandidates.filter((user) => params.recipientUserIds.includes(user.id));
  }

  async findAcceptedFollows(candidateIds: string[]): Promise<FollowPair[]> {
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
  }): Promise<FriendWithTodos[]> {
    this.queries.push({ method: "findFriendsWithTodayTodos", params });
    return this.friendsWithTodayTodos.filter((friend) => params.friendIds.includes(friend.id));
  }

  async findStreakAtRiskUsers(params: TodayRangeParams): Promise<UserWithTodosAndStreak[]> {
    this.queries.push({ method: "findStreakAtRiskUsers", params });
    return this.streakAtRiskUsers;
  }

  queriedMethods(): Array<keyof ReEngagementReaderPort> {
    return this.queries.map(({ method }) => method);
  }
}
