import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, lte, or, sql } from "drizzle-orm";

import {
  userDeliveryPreference,
  userReminderPreference,
} from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import {
  userLastActivityOf,
  userProfileNameOf,
  userRecipients,
} from "#api/modules/identity/users/identity-users.public";
import {
  completedTodoCountsByUser,
  hasOpenTodoBetween,
  hasTodoBetween,
  todoCompletionsBetween,
} from "#api/modules/planning/todos/planning-todos-queries.public";
import { acceptedFriendshipsOf } from "#api/modules/social/friendships/social-friendships.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { notificationRetentionAssignmentsConfig } from "../../../retention-assignments/notification-retention-assignments.public.js";
import type {
  InactiveWindowParams,
  ReEngagementReaderPort,
  SocialDigestCandidateParams,
  TodayRangeParams,
} from "../../application/ports/re-engagement-reader.port.js";
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
} from "../../application/read-models/scheduler.read-model.js";
import { toTodoCompletions } from "./scheduler-row.mapper.js";
import {
  recentTreatmentExclusion,
  type SchedulerRetentionSettings,
  userInTimezones,
} from "./scheduler.query-fragment.js";

// 연속 기록이 이만큼 이어진 사용자만 끊길 위기를 알린다
const STREAK_AT_RISK_MIN_DAYS = 3;

@Injectable()
export class DrizzleReEngagementReader implements ReEngagementReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #retention: SchedulerRetentionSettings;
  readonly #clock: ClockPort;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    @Inject(notificationRetentionAssignmentsConfig.KEY) retention: SchedulerRetentionSettings,
    clock: ClockPort,
  ) {
    this.#transactionHost = transactionHost;
    this.#retention = retention;
    this.#clock = clock;
  }

  listWinbackUsers(params: InactiveWindowParams): Promise<WinbackUserReadModel[]> {
    const { timezones, inactiveSince, inactiveUntil } = params;
    const recipients = userRecipients();
    const preference = userDeliveryPreference();
    return this.#db
      .select({
        id: recipients.userId,
        lastActiveAt: recipients.lastActiveAt,
        timezone: preference.timezone,
      })
      .from(recipients.table)
      .innerJoin(preference, eq(preference.userId, recipients.userId))
      .where(
        and(
          recentTreatmentExclusion(this.#retention, this.#clock, recipients.userId),
          inArray(preference.timezone, [...timezones]),
          gte(recipients.lastActiveAt, inactiveSince),
          lte(recipients.lastActiveAt, inactiveUntil),
        ),
      );
  }

  listOnboardingCandidates(params: {
    timezones: readonly string[];
    createdSince: Temporal.Instant;
  }): Promise<OnboardingCandidateReadModel[]> {
    const { timezones, createdSince } = params;
    const recipients = userRecipients();
    const preference = userDeliveryPreference();
    return this.#db
      .select({
        id: recipients.userId,
        createdAt: recipients.createdAt,
        timezone: preference.timezone,
      })
      .from(recipients.table)
      .innerJoin(preference, eq(preference.userId, recipients.userId))
      .where(
        and(
          recentTreatmentExclusion(this.#retention, this.#clock, recipients.userId),
          gte(recipients.createdAt, createdSince),
          inArray(preference.timezone, [...timezones]),
        ),
      );
  }

  countCompletedTodosByUsers(userIds: readonly UserId[]): Promise<UserTodoCountReadModel[]> {
    const counts = completedTodoCountsByUser(userIds);
    return this.#db.select({ userId: counts.userId, count: counts.count }).from(counts);
  }

  listActiveUsersInTimezones(timezones: readonly string[]): Promise<ActiveUserReadModel[]> {
    const recipients = userRecipients();
    const preference = userDeliveryPreference();
    return this.#db
      .select({ id: recipients.userId, timezone: preference.timezone })
      .from(recipients.table)
      .innerJoin(preference, eq(preference.userId, recipients.userId))
      .where(
        and(
          recipients.undeleted,
          recentTreatmentExclusion(this.#retention, this.#clock, recipients.userId),
          inArray(preference.timezone, [...timezones]),
        ),
      );
  }

  async listNudgeSuggestFollows(params: {
    candidateIds: readonly UserId[];
    activeSince: Temporal.Instant;
    activeUntil: Temporal.Instant;
  }): Promise<NudgeSuggestFollowReadModel[]> {
    const candidateIds = params.candidateIds.map((candidateId) => candidateId.value);
    const { activeSince, activeUntil } = params;
    const pairs = acceptedFriendshipsOf(candidateIds);
    const follower = userLastActivityOf(pairs.followerId, "follower_activity");
    const following = userLastActivityOf(pairs.followingId, "following_activity");
    const followerProfile = userProfileNameOf(pairs.followerId, "follower_profile");
    const followingProfile = userProfileNameOf(pairs.followingId, "following_profile");
    const activeWithin = (lastActiveAt: typeof follower.lastActiveAt) =>
      and(gte(lastActiveAt, activeSince), lte(lastActiveAt, activeUntil));
    const rows = await this.#db
      .select({
        followerId: pairs.followerId,
        followingId: pairs.followingId,
        followerLastActiveAt: follower.lastActiveAt,
        followingLastActiveAt: following.lastActiveAt,
        followerProfileUserId: followerProfile.userId,
        followerName: followerProfile.name,
        followingProfileUserId: followingProfile.userId,
        followingName: followingProfile.name,
      })
      .from(pairs)
      .innerJoinLateral(follower, sql`true`)
      .innerJoinLateral(following, sql`true`)
      .leftJoinLateral(followerProfile, sql`true`)
      .leftJoinLateral(followingProfile, sql`true`)
      .where(
        or(
          and(inArray(pairs.followerId, candidateIds), activeWithin(following.lastActiveAt)),
          and(inArray(pairs.followingId, candidateIds), activeWithin(follower.lastActiveAt)),
        ),
      );
    return rows.map((row) => ({
      followerId: row.followerId,
      followingId: row.followingId,
      follower: {
        id: row.followerId,
        lastActiveAt: row.followerLastActiveAt,
        profile: row.followerProfileUserId == null ? null : { name: row.followerName },
      },
      following: {
        id: row.followingId,
        lastActiveAt: row.followingLastActiveAt,
        profile: row.followingProfileUserId == null ? null : { name: row.followingName },
      },
    }));
  }

  async listSocialDigestCandidates(
    params: SocialDigestCandidateParams,
  ): Promise<SocialDigestCandidateReadModel[]> {
    const { timezones, today, tomorrow, recipientUserIds } = params;
    const recipients = userRecipients();
    const rows = await this.#db
      .select({
        id: recipients.userId,
        completions: todoCompletionsBetween(recipients.userId, today, tomorrow),
      })
      .from(recipients.table)
      .where(
        and(
          inArray(
            recipients.userId,
            recipientUserIds.map((userId) => userId.value),
          ),
          recentTreatmentExclusion(this.#retention, this.#clock, recipients.userId),
          userInTimezones(recipients.userId, timezones),
          hasOpenTodoBetween(recipients.userId, today, tomorrow),
        ),
      );
    return rows.map(({ id, completions }) => ({ id, todos: toTodoCompletions(completions) }));
  }

  listAcceptedFollows(candidateIds: readonly UserId[]): Promise<FollowPairReadModel[]> {
    const pairs = acceptedFriendshipsOf(candidateIds.map((candidateId) => candidateId.value));
    return this.#db
      .select({ followerId: pairs.followerId, followingId: pairs.followingId })
      .from(pairs);
  }

  async listFriendsWithTodayTodos(params: {
    friendIds: readonly UserId[];
    today: Temporal.PlainDate;
    tomorrow: Temporal.PlainDate;
  }): Promise<FriendWithTodosReadModel[]> {
    const { friendIds, today, tomorrow } = params;
    const recipients = userRecipients();
    const profile = userProfileNameOf(recipients.userId);
    const rows = await this.#db
      .select({
        id: recipients.userId,
        profileUserId: profile.userId,
        name: profile.name,
        completions: todoCompletionsBetween(recipients.userId, today, tomorrow),
      })
      .from(recipients.table)
      .leftJoinLateral(profile, sql`true`)
      .where(
        and(
          inArray(
            recipients.userId,
            friendIds.map((friendId) => friendId.value),
          ),
          hasTodoBetween(recipients.userId, today, tomorrow),
        ),
      );
    return rows.map(({ id, profileUserId, name, completions }) => ({
      id,
      profile: profileUserId == null ? null : { name },
      todos: toTodoCompletions(completions),
    }));
  }

  async listStreakAtRiskUsers(
    params: TodayRangeParams,
  ): Promise<UserWithTodosAndStreakReadModel[]> {
    const { timezones, today, tomorrow } = params;
    const recipients = userRecipients();
    const preference = userReminderPreference();
    const rows = await this.#db
      .select({
        id: recipients.userId,
        completions: todoCompletionsBetween(recipients.userId, today, tomorrow),
        currentStreak: preference.currentStreak,
        lastCompletedDate: preference.lastCompletedDate,
        locale: preference.locale,
      })
      .from(recipients.table)
      .innerJoin(preference, eq(preference.userId, recipients.userId))
      .where(
        and(
          recentTreatmentExclusion(this.#retention, this.#clock, recipients.userId),
          inArray(preference.timezone, [...timezones]),
          gte(preference.currentStreak, STREAK_AT_RISK_MIN_DAYS),
          hasOpenTodoBetween(recipients.userId, today, tomorrow),
        ),
      );
    return rows.map(({ id, completions, ...streak }) => ({
      id,
      todos: toTodoCompletions(completions),
      preference: streak,
    }));
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
