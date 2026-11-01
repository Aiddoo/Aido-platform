import { BROADCAST_TARGET_FILTER, type BroadcastTargetFilter } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { match } from "ts-pattern";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";

import type { AdminUserDirectoryPort } from "../../../application/ports/admin/admin-user-directory.port.js";

const BROADCAST_BATCH_SIZE = 500;

/**
 * AdminUserDirectoryPort의 Drizzle 어댑터.
 *
 * 대상 필터를 where 절로 변환하고, 커서 기반 배치 스트리밍으로
 * 대상 사용자 ID를 흘려보낸다. (필터 유효성은 도메인/Zod가 이미 보장)
 */
@Injectable()
export class DrizzleAdminUserDirectoryAdapter implements AdminUserDirectoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async *streamTargetUserIds(filter: BroadcastTargetFilter): AsyncIterable<string[]> {
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.db.query.user.findMany({
        columns: { id: true },
        where: {
          deletedAt: { isNull: true },
          status: "ACTIVE",
          ...this.#buildTargetWhere(filter),
          id: cursor == null ? undefined : { gt: cursor },
        },
        orderBy: { id: "asc" },
        limit: BROADCAST_BATCH_SIZE,
      });
      if (rows.length === 0) {
        break;
      }
      yield rows.map((row) => row.id);
      const last = rows.at(-1);
      if (rows.length < BROADCAST_BATCH_SIZE || last == null) {
        break;
      }
      cursor = last.id;
    }
  }

  async findExistingUserIds(userIds: string[]): Promise<string[]> {
    const rows = await this.db.query.user.findMany({
      columns: { id: true },
      where: { id: { in: userIds }, deletedAt: { isNull: true } },
    });
    return rows.map((row) => row.id);
  }

  #buildTargetWhere(filter: BroadcastTargetFilter) {
    return (
      match(filter)
        .with(BROADCAST_TARGET_FILTER.ALL, () => ({}))
        .with(BROADCAST_TARGET_FILTER.WITH_PUSH_TOKEN, () => ({ pushTokens: true }))
        .with(BROADCAST_TARGET_FILTER.ACTIVE_LAST_7_DAYS, () => ({
          lastLoginAt: { gte: subtractDays(7) },
        }))
        .with(BROADCAST_TARGET_FILTER.ACTIVE_LAST_30_DAYS, () => ({
          lastLoginAt: { gte: subtractDays(30) },
        }))
        // User projection이 보상 기간도 ACTIVE로 쓰므로 "구독자"에는 초대 보상으로 프리미엄인 사용자도 들어간다
        .with(BROADCAST_TARGET_FILTER.SUBSCRIBERS, () => ({
          subscriptionStatus: "ACTIVE" as const,
        }))
        .exhaustive()
    );
  }
}
