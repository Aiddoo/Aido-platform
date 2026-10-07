import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";
import { all, and } from "@prisma/orm-postgres/orm-client";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";

import type { WeeklyAchievementRepositoryPort } from "../../../application/ports/weekly-achievements/weekly-achievement.repository.port.js";
import type {
  WeeklyAchievementRow,
  WeeklyAchievementUpsert,
} from "../../../domain/records/weekly-achievements/weekly-achievement.record.js";

@Injectable()
export class PrismaWeeklyAchievementRepository implements WeeklyAchievementRepositoryPort {
  constructor(
    private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>,
    @Inject(UNIT_OF_WORK)
    private readonly uow: UnitOfWorkPort,
  ) {}

  private get client() {
    return this.txHost.tx;
  }

  async findByYear(
    userId: string,
    year: number,
    cursor: number | undefined,
    take: number,
  ): Promise<WeeklyAchievementRow[]> {
    const weeks = await this.client.orm.public.WeeklyAchievement.where((row) =>
      and(
        row.userId.eq(userId),
        row.year.eq(year),
        cursor === undefined
          ? all()
          : and(
              row.week.lt(cursor),
              row.user.some((user) =>
                user.weeklyAchievements.some((anchor) =>
                  and(anchor.year.eq(year), anchor.week.eq(cursor)),
                ),
              ),
            ),
      ),
    )
      .select("id", "year", "week", "totalTodos", "completedTodos", "achievedAt")
      .orderBy((row) => row.week.desc())
      .limit(take)
      .all();
    return decodeRecord("WeeklyAchievement", weeks);
  }

  async findAllByYear(userId: string, year: number): Promise<WeeklyAchievementRow[]> {
    const rows = await this.client.orm.public.WeeklyAchievement.where((row) =>
      and(row.userId.eq(userId), row.year.eq(year)),
    )
      .select("id", "year", "week", "totalTodos", "completedTodos", "achievedAt")
      .orderBy((row) => row.week.asc())
      .all();
    return decodeRecord("WeeklyAchievement", rows);
  }

  async findByYearAndWeek(
    userId: string,
    year: number,
    week: number,
  ): Promise<WeeklyAchievementRow | null> {
    const row = await this.client.orm.public.WeeklyAchievement.where((row) =>
      and(row.userId.eq(userId), row.year.eq(year), row.week.eq(week)),
    )
      .select("id", "year", "week", "totalTodos", "completedTodos", "achievedAt")
      .first();
    return decodeRecord("WeeklyAchievement", row);
  }

  async upsertMany(snapshots: readonly WeeklyAchievementUpsert[]): Promise<void> {
    if (snapshots.length === 0) {
      return;
    }

    await this.uow.run(async () => {
      for (const { userId, year, week, totalTodos, completedTodos, achievedAt } of snapshots) {
        await this.client.orm.public.WeeklyAchievement.select("id").upsert({
          conflictOn: encodePatch("WeeklyAchievement", { userId, year, week }),
          create: encodeCreate("WeeklyAchievement", {
            userId,
            year,
            week,
            totalTodos,
            completedTodos,
            achievedAt,
          }),
          update: encodePatch("WeeklyAchievement", { totalTodos, completedTodos, achievedAt }),
        });
      }
    });
  }
}
