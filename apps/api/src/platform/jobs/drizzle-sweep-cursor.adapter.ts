import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import type { Database } from "#api/platform/database/database.client";
import { scheduledSweepCursor } from "#api/platform/database/schema/index";
import { SweepCursorPort } from "#api/shared/application/ports/sweep-cursor.port";

interface CursorTransactionSource {
  // oxlint-disable-next-line aido/no-abbreviation -- @nestjs-cls/transactional TransactionHost.tx 속성 이름을 따른다
  readonly tx: Database;
}

@Injectable()
export class DrizzleSweepCursorAdapter extends SweepCursorPort {
  readonly #transactionHost: CursorTransactionSource;

  constructor(@Inject(TransactionHost) transactionHost: CursorTransactionSource) {
    super();
    this.#transactionHost = transactionHost;
  }

  async findLastCompletedAt(key: string): Promise<Temporal.Instant | null> {
    const [row] = await this.#transactionHost.tx
      .select({ lastCompletedAt: scheduledSweepCursor.lastCompletedAt })
      .from(scheduledSweepCursor)
      .where(eq(scheduledSweepCursor.key, key));
    return row?.lastCompletedAt ?? null;
  }

  async markCompleted(key: string, at: Temporal.Instant): Promise<void> {
    await this.#transactionHost.tx
      .insert(scheduledSweepCursor)
      .values({ key, lastCompletedAt: at })
      .onConflictDoUpdate({
        target: scheduledSweepCursor.key,
        set: {
          lastCompletedAt: sql`GREATEST(${scheduledSweepCursor.lastCompletedAt}, excluded."lastCompletedAt")`,
        },
      });
  }
}
