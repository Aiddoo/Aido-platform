import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";

import type { WeeklyAchievementRepositoryPort } from "../../../application/ports/weekly-achievements/weekly-achievement.repository.port.js";
import type {
  WeeklyAchievementRow,
  WeeklyAchievementUpsert,
} from "../../../domain/policies/weekly-achievements/weekly-achievement.js";

/**
 * WeeklyAchievementRepositoryPort의 Prisma 어댑터.
 *
 * 트랜잭션은 CLS로 전파된다 — TransactionHost.tx가 활성 트랜잭션(없으면 베이스)을
 * 반환하며, 일괄 upsert는 UnitOfWork로 원자성을 보장한다.
 */
@Injectable()
export class PrismaWeeklyAchievementRepository implements WeeklyAchievementRepositoryPort {
  constructor(
    private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>,
    @Inject(UNIT_OF_WORK)
    private readonly uow: UnitOfWorkPort,
  ) {}

  /** 활성 트랜잭션(없으면 베이스 클라이언트) */
  private get client() {
    return this.txHost.tx;
  }

  async findByYear(
    userId: string,
    year: number,
    cursor: number | undefined,
    take: number,
  ): Promise<WeeklyAchievementRow[]> {
    let weeks = this.client.orm.public.WeeklyAchievement.where({ userId, year })
      .select("id", "year", "week", "totalTodos", "completedTodos", "achievedAt")
      .orderBy((row) => row.week.desc())
      .limit(take);
    if (cursor !== undefined) {
      const anchor = await this.client.orm.public.WeeklyAchievement.where({
        userId,
        year,
        week: cursor,
      })
        .select("week")
        .first();
      if (anchor === null) return [];
      weeks = weeks.cursor(anchor);
    }
    return decodeRecord("WeeklyAchievement", await weeks.all());
  }

  async findAllByYear(userId: string, year: number): Promise<WeeklyAchievementRow[]> {
    return await this.client.orm.public.WeeklyAchievement.where((row) =>
      and(row.userId.eq(userId), row.year.eq(year)),
    )
      .select("id", "year", "week", "totalTodos", "completedTodos", "achievedAt")
      .orderBy((row) => row.week.asc())
      .all()
      .then((row) => decodeRecord("WeeklyAchievement", row));
  }

  async findByYearAndWeek(
    userId: string,
    year: number,
    week: number,
  ): Promise<WeeklyAchievementRow | null> {
    return await this.client.orm.public.WeeklyAchievement.where((row) =>
      and(row.userId.eq(userId), row.year.eq(year), row.week.eq(week)),
    )
      .select("id", "year", "week", "totalTodos", "completedTodos", "achievedAt")
      .first()
      .then((row) => decodeRecord("WeeklyAchievement", row));
  }

  async upsertMany(snapshots: WeeklyAchievementUpsert[]): Promise<void> {
    if (snapshots.length === 0) {
      return;
    }

    await this.uow.run(async () => {
      for (const { userId, year, week, totalTodos, completedTodos, achievedAt } of snapshots) {
        decodeRecord(
          "WeeklyAchievement",
          await this.client.orm.public.WeeklyAchievement.where((row) =>
            and(row.userId.eq(userId), row.year.eq(year), row.week.eq(week)),
          ).upsert({
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
          }),
        );
      }
    });
  }
}
