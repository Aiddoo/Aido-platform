import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { weeklyAchievement as weeklyAchievementTable } from "#api/platform/database/schema/insights.schema";
import { nextSequenceValues } from "#api/platform/database/sequence";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { WeeklyAchievementRepositoryPort } from "../../application/ports/weekly-achievement.repository.port.js";
import type { IsoWeek } from "../../domain/iso-week.vo.js";
import { WeeklyAchievementId } from "../../domain/weekly-achievement-id.vo.js";
import type { WeeklyAchievement } from "../../domain/weekly-achievement.aggregate.js";
import { toWeeklyAchievement, toWeeklyAchievementRow } from "./weekly-achievement-row.mapper.js";

const ROW_COLUMNS = {
  id: true,
  userId: true,
  year: true,
  week: true,
  totalTodos: true,
  completedTodos: true,
  achievedAt: true,
} as const;

@Injectable()
export class DrizzleWeeklyAchievementRepository implements WeeklyAchievementRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextIds(count: number): Promise<WeeklyAchievementId[]> {
    const values = await nextSequenceValues(this.#db, weeklyAchievementTable.id, count);
    return values.map((value) => WeeklyAchievementId.reconstitute(value));
  }

  async listByYear(params: {
    readonly userId: UserId;
    readonly year: number;
    readonly afterWeek: number | null;
    readonly limit: number;
  }): Promise<WeeklyAchievement[]> {
    const { year, afterWeek, limit } = params;
    const userId = params.userId.value;
    if (afterWeek != null) {
      const anchor = await this.#db.query.weeklyAchievement.findFirst({
        columns: { id: true },
        where: { userId, year, week: afterWeek },
      });
      if (anchor == null) {
        return [];
      }
    }

    const rows = await this.#db.query.weeklyAchievement.findMany({
      columns: ROW_COLUMNS,
      where: { userId, year, ...(afterWeek == null ? {} : { week: { lt: afterWeek } }) },
      orderBy: { week: "desc" },
      limit,
    });
    return rows.map(toWeeklyAchievement);
  }

  async listAllByYear(params: {
    readonly userId: UserId;
    readonly year: number;
  }): Promise<WeeklyAchievement[]> {
    const rows = await this.#db.query.weeklyAchievement.findMany({
      columns: ROW_COLUMNS,
      where: { userId: params.userId.value, year: params.year },
      orderBy: { week: "asc" },
    });
    return rows.map(toWeeklyAchievement);
  }

  async findByWeek(params: {
    readonly userId: UserId;
    readonly isoWeek: IsoWeek;
  }): Promise<WeeklyAchievement | null> {
    const row = await this.#db.query.weeklyAchievement.findFirst({
      columns: ROW_COLUMNS,
      where: {
        userId: params.userId.value,
        year: params.isoWeek.year,
        week: params.isoWeek.week,
      },
    });
    return row == null ? null : toWeeklyAchievement(row);
  }

  async saveAll(achievements: readonly WeeklyAchievement[]): Promise<void> {
    if (achievements.length === 0) {
      return;
    }

    // 한 문장에 같은 키가 둘이면 ON CONFLICT DO UPDATE가 실패하므로 마지막 값만 남긴다
    const latestByWeek = new Map(
      achievements.map((achievement) => [
        `${achievement.userId.value}:${achievement.isoWeek.year}:${achievement.isoWeek.week}`,
        toWeeklyAchievementRow(achievement),
      ]),
    );

    await this.#db
      .insert(weeklyAchievementTable)
      .values([...latestByWeek.values()])
      .onConflictDoUpdate({
        target: [
          weeklyAchievementTable.userId,
          weeklyAchievementTable.year,
          weeklyAchievementTable.week,
        ],
        set: {
          totalTodos: sql`excluded."totalTodos"`,
          completedTodos: sql`excluded."completedTodos"`,
          achievedAt: sql`excluded."achievedAt"`,
        },
      });
  }
}
