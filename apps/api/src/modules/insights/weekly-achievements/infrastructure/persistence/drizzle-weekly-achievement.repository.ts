import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { weeklyAchievement } from "#api/platform/database/schema/index";

import type { WeeklyAchievementRepositoryPort } from "../../application/ports/weekly-achievement.repository.port.js";
import type {
  WeeklyAchievementRow,
  WeeklyAchievementUpsert,
} from "../../domain/weekly-achievement.read-model.js";

const rowColumns = {
  id: true,
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

  async findByYear(
    userId: string,
    year: number,
    cursor: number | undefined,
    take: number,
  ): Promise<WeeklyAchievementRow[]> {
    if (cursor != null) {
      const anchor = await this.#db.query.weeklyAchievement.findFirst({
        columns: { id: true },
        where: { userId, year, week: cursor },
      });
      if (anchor == null) {
        return [];
      }
    }

    return this.#db.query.weeklyAchievement.findMany({
      columns: rowColumns,
      where: { userId, year, ...(cursor == null ? {} : { week: { lt: cursor } }) },
      orderBy: { week: "desc" },
      limit: take,
    });
  }

  findAllByYear(userId: string, year: number): Promise<WeeklyAchievementRow[]> {
    return this.#db.query.weeklyAchievement.findMany({
      columns: rowColumns,
      where: { userId, year },
      orderBy: { week: "asc" },
    });
  }

  async findByYearAndWeek(
    userId: string,
    year: number,
    week: number,
  ): Promise<WeeklyAchievementRow | null> {
    const row = await this.#db.query.weeklyAchievement.findFirst({
      columns: rowColumns,
      where: { userId, year, week },
    });
    return row ?? null;
  }

  async upsertMany(snapshots: readonly WeeklyAchievementUpsert[]): Promise<void> {
    if (snapshots.length === 0) {
      return;
    }

    // 한 문장에 같은 키가 둘이면 ON CONFLICT DO UPDATE가 실패하므로 마지막 값만 남긴다
    const latestByWeek = new Map(
      snapshots.map((snapshot) => [
        `${snapshot.userId}:${snapshot.year}:${snapshot.week}`,
        snapshot,
      ]),
    );

    await this.#db
      .insert(weeklyAchievement)
      .values([...latestByWeek.values()])
      .onConflictDoUpdate({
        target: [weeklyAchievement.userId, weeklyAchievement.year, weeklyAchievement.week],
        set: {
          totalTodos: sql`excluded."totalTodos"`,
          completedTodos: sql`excluded."completedTodos"`,
          achievedAt: sql`excluded."achievedAt"`,
        },
      });
  }
}
