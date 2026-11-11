import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import type { Database } from "#api/platform/database/database.client";
import { scheduledSweepCursor } from "#api/platform/database/schema/index";
import { SweepCursorPort } from "#api/shared/application/ports/sweep-cursor.port";

interface CursorTransactionSource {
  readonly tx: Database;
}

@Injectable()
export class DrizzleSweepCursorAdapter extends SweepCursorPort {
  readonly #txHost: CursorTransactionSource;

  constructor(@Inject(TransactionHost) txHost: CursorTransactionSource) {
    super();
    this.#txHost = txHost;
  }

  async findLastCompletedAt(key: string): Promise<Temporal.Instant | null> {
    const [row] = await this.#txHost.tx
      .select({ lastCompletedAt: scheduledSweepCursor.lastCompletedAt })
      .from(scheduledSweepCursor)
      .where(eq(scheduledSweepCursor.key, key));
    return row?.lastCompletedAt ?? null;
  }

  async markCompleted(key: string, at: Temporal.Instant): Promise<void> {
    await this.#txHost.tx
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
