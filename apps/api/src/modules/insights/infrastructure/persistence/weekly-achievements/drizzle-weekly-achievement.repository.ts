import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { weeklyAchievement } from "#api/platform/database/schema/index";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";

import type { WeeklyAchievementRepositoryPort } from "../../../application/ports/weekly-achievements/weekly-achievement.repository.port.js";
import type {
  WeeklyAchievementRow,
  WeeklyAchievementUpsert,
} from "../../../domain/records/weekly-achievements/weekly-achievement.record.js";

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
  constructor(
    private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>,
    @Inject(UNIT_OF_WORK)
    private readonly uow: UnitOfWorkPort,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  async findByYear(
    userId: string,
    year: number,
    cursor: number | undefined,
    take: number,
  ): Promise<WeeklyAchievementRow[]> {
    if (cursor != null) {
      const anchor = await this.db.query.weeklyAchievement.findFirst({
        columns: { id: true },
        where: { userId, year, week: cursor },
      });
      if (anchor == null) {
        return [];
      }
    }

    return this.db.query.weeklyAchievement.findMany({
      columns: rowColumns,
      where: { userId, year, ...(cursor == null ? {} : { week: { lt: cursor } }) },
      orderBy: { week: "desc" },
      limit: take,
    });
  }

  findAllByYear(userId: string, year: number): Promise<WeeklyAchievementRow[]> {
    return this.db.query.weeklyAchievement.findMany({
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
    const row = await this.db.query.weeklyAchievement.findFirst({
      columns: rowColumns,
      where: { userId, year, week },
    });
    return row ?? null;
  }

  async upsertMany(snapshots: readonly WeeklyAchievementUpsert[]): Promise<void> {
    if (snapshots.length === 0) {
      return;
    }

    await this.uow.run(async () => {
      for (const snapshot of snapshots) {
        await this.db
          .insert(weeklyAchievement)
          .values(snapshot)
          .onConflictDoUpdate({
            target: [weeklyAchievement.userId, weeklyAchievement.year, weeklyAchievement.week],
            set: {
              totalTodos: snapshot.totalTodos,
              completedTodos: snapshot.completedTodos,
              achievedAt: snapshot.achievedAt,
            },
          });
      }
    });
  }
}
