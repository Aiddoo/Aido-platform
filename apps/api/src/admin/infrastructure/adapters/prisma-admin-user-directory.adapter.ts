import { BROADCAST_TARGET_FILTER } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import type { ModelAccessor } from "@prisma/orm-postgres/orm-client";
import { all, and } from "@prisma/orm-postgres/orm-client";
import { match } from "ts-pattern";

import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { decodeRecord } from "#api/shared/infrastructure/database/database-records";
import { databaseTimestamp } from "#api/shared/infrastructure/database/database-values";
import { DatabaseService } from "#api/shared/infrastructure/database/database.service";

import type { Contract } from "../../../generated/prisma8/contract.d.js";
import type { AdminUserDirectoryPort } from "../../application/ports/admin-user-directory.port.js";
import type { BroadcastTargetFilter } from "../../domain/broadcast-message.js";

const BROADCAST_BATCH_SIZE = 500;

/**
 * AdminUserDirectoryPort의 Prisma 어댑터.
 *
 * 대상 필터를 Prisma where 절로 변환하고, 커서 기반 배치 스트리밍으로
 * 대상 사용자 ID를 흘려보낸다. (필터 유효성은 도메인/Zod가 이미 보장)
 */
@Injectable()
export class PrismaAdminUserDirectoryAdapter implements AdminUserDirectoryPort {
  constructor(private readonly database: DatabaseService) {}

  async *streamTargetUserIds(filter: BroadcastTargetFilter): AsyncIterable<string[]> {
    const users = this.database.db.orm.public.User.where((user) =>
      and(user.deletedAt.isNull(), user.status.eq("ACTIVE"), this.#buildTargetWhere(filter, user)),
    )
      .select("id")
      .orderBy((user) => user.id.asc())
      .limit(BROADCAST_BATCH_SIZE);
    let cursor: string | undefined;
    for (;;) {
      const rows = await users
        .where((user) => (cursor !== undefined ? user.id.gt(cursor) : all()))
        .all();
      if (rows.length === 0) break;
      yield rows.map((row) => row.id);
      const last = rows.at(-1);
      if (rows.length < BROADCAST_BATCH_SIZE || last === undefined) break;
      cursor = last.id;
    }
  }

  async findExistingUserIds(userIds: string[]): Promise<string[]> {
    const rows = decodeRecord(
      "User",
      await this.database.db.orm.public.User.where((row) =>
        and(row.id.in(userIds), row.deletedAt.isNull()),
      )
        .select("id")
        .all(),
    );
    return rows.map((row) => row.id);
  }

  #buildTargetWhere(
    filter: BroadcastTargetFilter,
    user: ModelAccessor<Contract, "User", "public">,
  ) {
    return match(filter)
      .with(BROADCAST_TARGET_FILTER.ALL, () => all())
      .with(BROADCAST_TARGET_FILTER.WITH_PUSH_TOKEN, () => user.pushTokens.some())
      .with(BROADCAST_TARGET_FILTER.ACTIVE_LAST_7_DAYS, () =>
        user.lastLoginAt.gte(databaseTimestamp(subtractDays(7))),
      )
      .with(BROADCAST_TARGET_FILTER.ACTIVE_LAST_30_DAYS, () =>
        user.lastLoginAt.gte(databaseTimestamp(subtractDays(30))),
      )
      .with(BROADCAST_TARGET_FILTER.SUBSCRIBERS, () => user.subscriptionStatus.eq("ACTIVE"))
      .exhaustive();
  }
}
