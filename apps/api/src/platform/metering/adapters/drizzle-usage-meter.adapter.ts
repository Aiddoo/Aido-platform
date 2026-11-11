import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, lt, or, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { outboundUsage } from "#api/platform/database/schema/outbound.schema";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import {
  type UsageIncrement,
  type UsageKey,
  UsageMeterPort,
  type UsageReservation,
} from "../usage-meter.port.js";

const toUsageId = (key: Pick<UsageKey, "meter" | "periodKey" | "subject">) =>
  `${key.meter}\u0000${key.periodKey}\u0000${key.subject}`;

const whereUsageKey = (key: UsageKey) =>
  and(
    eq(outboundUsage.meter, key.meter),
    eq(outboundUsage.periodKey, key.periodKey),
    eq(outboundUsage.subject, key.subject),
  );

/** 기간별 한 행을 `ON CONFLICT DO UPDATE … RETURNING`으로 원자적으로 더한다(QuotaUsage와 같은 방식). */
@Injectable()
export class DrizzleUsageMeterAdapter extends UsageMeterPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    super();
    this.#txHost = txHost;
    this.#clock = clock;
  }

  async add(increments: readonly UsageIncrement[]): Promise<readonly number[]> {
    if (increments.length === 0) {
      return [];
    }
    const merged = new Map<string, UsageIncrement>();
    for (const increment of increments) {
      const id = toUsageId(increment.key);
      const previous = merged.get(id);
      merged.set(id, {
        key: increment.key,
        amount: (previous?.amount ?? 0) + increment.amount,
      });
    }
    const at = this.#clock.now();
    const rows = await this.#txHost.tx
      .insert(outboundUsage)
      .values(
        [...merged.values()].map(({ key, amount }) => ({ ...key, used: amount, updatedAt: at })),
      )
      .onConflictDoUpdate({
        target: [outboundUsage.meter, outboundUsage.periodKey, outboundUsage.subject],
        set: { used: sql`${outboundUsage.used} + excluded."used"`, updatedAt: at },
      })
      .returning({
        meter: outboundUsage.meter,
        periodKey: outboundUsage.periodKey,
        subject: outboundUsage.subject,
        used: outboundUsage.used,
      });
    const totals = new Map(rows.map((row) => [toUsageId(row), row.used]));
    return increments.map(({ key }) => totals.get(toUsageId(key)) ?? 0);
  }

  async tryReserve(key: UsageKey, amount: number, limit: number): Promise<UsageReservation> {
    if (amount > limit) {
      const [current] = await this.read([key]);
      return { isAccepted: false, total: current ?? 0 };
    }
    const at = this.#clock.now();
    const [reserved] = await this.#txHost.tx
      .insert(outboundUsage)
      .values({ ...key, used: amount, updatedAt: at })
      .onConflictDoUpdate({
        target: [outboundUsage.meter, outboundUsage.periodKey, outboundUsage.subject],
        set: { used: sql`${outboundUsage.used} + ${amount}`, updatedAt: at },
        setWhere: sql`${outboundUsage.used} + ${amount} <= ${limit}`,
      })
      .returning({ used: outboundUsage.used });
    if (reserved != null) {
      return { isAccepted: true, total: reserved.used };
    }
    const [current] = await this.read([key]);
    return { isAccepted: false, total: current ?? 0 };
  }

  async release(key: UsageKey, amount: number): Promise<void> {
    await this.#txHost.tx
      .update(outboundUsage)
      .set({
        used: sql`greatest(${outboundUsage.used} - ${amount}, 0)`,
        updatedAt: this.#clock.now(),
      })
      .where(whereUsageKey(key));
  }

  async read(keys: readonly UsageKey[]): Promise<readonly number[]> {
    if (keys.length === 0) {
      return [];
    }
    const rows = await this.#txHost.tx
      .select({
        meter: outboundUsage.meter,
        periodKey: outboundUsage.periodKey,
        subject: outboundUsage.subject,
        used: outboundUsage.used,
      })
      .from(outboundUsage)
      .where(or(...keys.map(whereUsageKey)));
    const totals = new Map(rows.map((row) => [toUsageId(row), row.used]));
    return keys.map((key) => totals.get(toUsageId(key)) ?? 0);
  }

  async prune(cutoff: Temporal.Instant): Promise<number> {
    const deleted = await this.#txHost.tx
      .delete(outboundUsage)
      .where(lt(outboundUsage.updatedAt, cutoff))
      .returning({ meter: outboundUsage.meter });
    return deleted.length;
  }

  async deleteSubject(subject: string): Promise<number> {
    const deleted = await this.#txHost.tx
      .delete(outboundUsage)
      .where(eq(outboundUsage.subject, subject))
      .returning({ meter: outboundUsage.meter });
    return deleted.length;
  }
}
