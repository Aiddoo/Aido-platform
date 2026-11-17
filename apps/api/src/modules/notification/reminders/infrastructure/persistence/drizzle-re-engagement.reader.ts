import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, inArray } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo } from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { notificationRetentionAssignmentsConfig } from "../../../retention-assignments/notification-retention-assignments.public.js";
import type {
  InactiveWindowParams,
  ReEngagementReaderPort,
  SocialDigestCandidateParams,
  TodayRangeParams,
} from "../../application/ports/re-engagement-reader.port.js";
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
} from "../../application/read-models/scheduler.read-model.js";
import {
  recentTreatmentExclusion,
  type SchedulerRetentionSettings,
} from "./scheduler.query-fragment.js";

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

  async findWinbackUsers(params: InactiveWindowParams): Promise<WinbackUserReadModel[]> {
    const { timezones, inactiveSince, inactiveUntil } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true, lastActiveAt: true },
      where: {
        AND: [
          ...recentTreatmentExclusion(this.#retention, this.#clock),
          { preference: { timezone: { in: [...timezones] } } },
          {
            lastActiveAt: {
              gte: inactiveSince,
              lte: inactiveUntil,
            },
          },
        ],
      },
    });
    return rows;
  }

  async findOnboardingCandidates(params: {
    timezones: readonly string[];
    createdSince: Temporal.Instant;
  }): Promise<OnboardingCandidateReadModel[]> {
    const { timezones, createdSince } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true, createdAt: true },
      where: {
        AND: [
          ...recentTreatmentExclusion(this.#retention, this.#clock),
          { createdAt: { gte: createdSince } },
          { preference: { timezone: { in: [...timezones] } } },
        ],
      },
    });
    return rows;
  }

  countCompletedTodosByUsers(userIds: string[]): Promise<UserTodoCountReadModel[]> {
    return this.#db
      .select({ userId: todo.userId, count: count() })
      .from(todo)
      .where(and(inArray(todo.userId, userIds), eq(todo.completed, true)))
      .groupBy(todo.userId);
  }

  findActiveUsersInTimezones(timezones: readonly string[]): Promise<UserIdReadModel[]> {
    return this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        AND: [
          { deletedAt: { isNull: true } },
          ...recentTreatmentExclusion(this.#retention, this.#clock),
          { preference: { timezone: { in: [...timezones] } } },
        ],
      },
    });
  }

  async findNudgeSuggestFollows(params: {
    candidateIds: string[];
    activeSince: Temporal.Instant;
    activeUntil: Temporal.Instant;
  }): Promise<NudgeSuggestFollowReadModel[]> {
    const { candidateIds, activeSince, activeUntil } = params;
    const activeWindow = {
      lastActiveAt: { gte: activeSince, lte: activeUntil },
    };
    const rows = await this.#db.query.friendship.findMany({
      columns: { followerId: true, followingId: true },
      where: {
        OR: [
          { followerId: { in: candidateIds }, status: "ACCEPTED", following: activeWindow },
          { followingId: { in: candidateIds }, status: "ACCEPTED", follower: activeWindow },
        ],
      },
      with: {
        follower: {
          columns: { id: true, lastActiveAt: true },
          with: { profile: { columns: { name: true } } },
        },
        following: {
          columns: { id: true, lastActiveAt: true },
          with: { profile: { columns: { name: true } } },
        },
      },
    });
    return rows;
  }

  findSocialDigestCandidates(
    params: SocialDigestCandidateParams,
  ): Promise<SocialDigestCandidateReadModel[]> {
    const { timezones, today, tomorrow, recipientUserIds } = params;
    return this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        AND: [
          { id: { in: [...recipientUserIds] } },
          ...recentTreatmentExclusion(this.#retention, this.#clock),
          { preference: { timezone: { in: [...timezones] } } },
          {
            todos: {
              startDate: { gte: today, lt: tomorrow },
              completed: false,
            },
          },
        ],
      },
      with: {
        todos: {
          columns: { completed: true },
          where: { startDate: { gte: today, lt: tomorrow } },
        },
      },
    });
  }

  findAcceptedFollows(candidateIds: string[]): Promise<FollowPairReadModel[]> {
    return this.#db.query.friendship.findMany({
      columns: { followerId: true, followingId: true },
      where: {
        OR: [
          { followerId: { in: candidateIds }, status: "ACCEPTED" },
          { followingId: { in: candidateIds }, status: "ACCEPTED" },
        ],
      },
    });
  }

  findFriendsWithTodayTodos(params: {
    friendIds: string[];
    today: Temporal.PlainDate;
    tomorrow: Temporal.PlainDate;
  }): Promise<FriendWithTodosReadModel[]> {
    const { friendIds, today, tomorrow } = params;
    return this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        id: { in: friendIds },
        todos: { startDate: { gte: today, lt: tomorrow } },
      },
      with: {
        profile: { columns: { name: true } },
        todos: {
          columns: { completed: true },
          where: { startDate: { gte: today, lt: tomorrow } },
        },
      },
    });
  }

  async findStreakAtRiskUsers(
    params: TodayRangeParams,
  ): Promise<UserWithTodosAndStreakReadModel[]> {
    const { timezones, today, tomorrow } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        AND: [
          ...recentTreatmentExclusion(this.#retention, this.#clock),
          { preference: { timezone: { in: [...timezones] }, currentStreak: { gte: 3 } } },
          {
            todos: {
              startDate: { gte: today, lt: tomorrow },
              completed: false,
            },
          },
        ],
      },
      with: {
        todos: {
          columns: { completed: true },
          where: { startDate: { gte: today, lt: tomorrow } },
        },
        preference: { columns: { currentStreak: true, lastCompletedDate: true, locale: true } },
      },
    });
    return rows;
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
