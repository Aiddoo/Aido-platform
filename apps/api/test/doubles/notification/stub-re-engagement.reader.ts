import {
  type InactiveWindowParams,
  ReEngagementReaderPort,
  type SocialDigestCandidateParams,
  type TodayRangeParams,
} from "#api/modules/notification/reminders/application/ports/re-engagement-reader.port";
import type {
  ActiveUserReadModel,
  FollowPairReadModel,
  FriendWithTodosReadModel,
  NudgeSuggestFollowReadModel,
  OnboardingCandidateReadModel,
  SocialDigestCandidateReadModel,
  UserTodoCountReadModel,
  UserWithTodosAndStreakReadModel,
  WinbackUserReadModel,
} from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface ReEngagementQuery {
  readonly method: keyof ReEngagementReaderPort;
  readonly params: unknown;
}

// 넣어 둔 대상을 주되 ID로 묻는 조회는 그 ID에 걸린 행만 준다. 기간·시간대 조건은 SQL이 맡는다
export class StubReEngagementReader extends ReEngagementReaderPort {
  winbackUsers: WinbackUserReadModel[] = [];
  onboardingCandidates: OnboardingCandidateReadModel[] = [];
  completedTodoCounts: UserTodoCountReadModel[] = [];
  activeUsers: ActiveUserReadModel[] = [];
  nudgeSuggestFollows: NudgeSuggestFollowReadModel[] = [];
  socialDigestCandidates: SocialDigestCandidateReadModel[] = [];
  acceptedFollows: FollowPairReadModel[] = [];
  friendsWithTodayTodos: FriendWithTodosReadModel[] = [];
  streakAtRiskUsers: UserWithTodosAndStreakReadModel[] = [];
  readonly queries: ReEngagementQuery[] = [];

  async listWinbackUsers(params: InactiveWindowParams): Promise<WinbackUserReadModel[]> {
    this.queries.push({ method: "listWinbackUsers", params });
    return this.winbackUsers;
  }

  async listOnboardingCandidates(params: {
    timezones: readonly string[];
    createdSince: Temporal.Instant;
  }): Promise<OnboardingCandidateReadModel[]> {
    this.queries.push({ method: "listOnboardingCandidates", params });
    return this.onboardingCandidates;
  }

  async countCompletedTodosByUsers(users: readonly UserId[]): Promise<UserTodoCountReadModel[]> {
    const userIds = users.map((userId) => userId.value);
    this.queries.push({ method: "countCompletedTodosByUsers", params: userIds });
    return this.completedTodoCounts.filter((row) => userIds.includes(row.userId));
  }

  async listActiveUsersInTimezones(timezones: readonly string[]): Promise<ActiveUserReadModel[]> {
    this.queries.push({ method: "listActiveUsersInTimezones", params: [...timezones] });
    return this.activeUsers;
  }

  async listNudgeSuggestFollows(params: {
    candidateIds: readonly UserId[];
    activeSince: Temporal.Instant;
    activeUntil: Temporal.Instant;
  }): Promise<NudgeSuggestFollowReadModel[]> {
    const candidateIds = params.candidateIds.map((candidateId) => candidateId.value);
    this.queries.push({ method: "listNudgeSuggestFollows", params: { ...params, candidateIds } });
    return this.nudgeSuggestFollows.filter(
      (follow) =>
        candidateIds.includes(follow.followerId) || candidateIds.includes(follow.followingId),
    );
  }

  async listSocialDigestCandidates(
    params: SocialDigestCandidateParams,
  ): Promise<SocialDigestCandidateReadModel[]> {
    const recipientUserIds = params.recipientUserIds.map((userId) => userId.value);
    this.queries.push({
      method: "listSocialDigestCandidates",
      params: { ...params, recipientUserIds },
    });
    return this.socialDigestCandidates.filter((user) => recipientUserIds.includes(user.id));
  }

  async listAcceptedFollows(candidates: readonly UserId[]): Promise<FollowPairReadModel[]> {
    const candidateIds = candidates.map((candidateId) => candidateId.value);
    this.queries.push({ method: "listAcceptedFollows", params: candidateIds });
    return this.acceptedFollows.filter(
      (follow) =>
        candidateIds.includes(follow.followerId) || candidateIds.includes(follow.followingId),
    );
  }

  async listFriendsWithTodayTodos(params: {
    friendIds: readonly UserId[];
    today: Temporal.PlainDate;
    tomorrow: Temporal.PlainDate;
  }): Promise<FriendWithTodosReadModel[]> {
    const friendIds = params.friendIds.map((friendId) => friendId.value);
    this.queries.push({ method: "listFriendsWithTodayTodos", params: { ...params, friendIds } });
    return this.friendsWithTodayTodos.filter((friend) => friendIds.includes(friend.id));
  }

  async listStreakAtRiskUsers(
    params: TodayRangeParams,
  ): Promise<UserWithTodosAndStreakReadModel[]> {
    this.queries.push({ method: "listStreakAtRiskUsers", params });
    return this.streakAtRiskUsers;
  }

  queriedMethods(): Array<keyof ReEngagementReaderPort> {
    return this.queries.map(({ method }) => method);
  }
}
