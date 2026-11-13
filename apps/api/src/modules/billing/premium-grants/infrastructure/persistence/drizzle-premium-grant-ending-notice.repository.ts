import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gt, gte, inArray, isNull, lte, ne, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleGreaterThan } from "#api/platform/database/keyset";
import { premiumGrant, subscription } from "#api/platform/database/schema/billing.schema";

import type { ListDueBillingNoticesParams } from "../../../shared/application/ports/billing-notice.repository.port.js";
import type { PremiumGrantEndingNoticeRepositoryPort } from "../../application/ports/premium-grant-ending-notice.repository.port.js";
import type { PremiumGrantEndingNotice } from "../../domain/premium-grant-ending-notice.entity.js";
import { toPremiumGrantEndingNotice } from "./premium-grant-ending-notice-row.mapper.js";

const grantOf = alias(premiumGrant, "grant");
const nextOf = alias(premiumGrant, "next");
const storeOf = alias(subscription, "store");

@Injectable()
export class DrizzlePremiumGrantEndingNoticeRepository implements PremiumGrantEndingNoticeRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  // 뒤에 다른 보상 기간이나 스토어 구독이 이어지면 프리미엄이 끝나지 않으므로 마지막 기간만 고른다
  async listDue(
    params: ListDueBillingNoticesParams<PremiumGrantEndingNotice>,
  ): Promise<PremiumGrantEndingNotice[]> {
    const rows = await this.#db
      .select({ id: grantOf.id, userId: grantOf.userId, endsAt: grantOf.endsAt })
      .from(grantOf)
      .where(
        and(
          eq(grantOf.status, "ACTIVE"),
          isNull(grantOf.endingNotifiedAt),
          gt(grantOf.endsAt, params.now),
          lte(grantOf.endsAt, params.endsBefore),
          notExists(
            this.#db
              .select({ one: sql`1` })
              .from(nextOf)
              .where(
                and(
                  eq(nextOf.userId, grantOf.userId),
                  ne(nextOf.id, grantOf.id),
                  or(
                    eq(nextOf.status, "BANKED"),
                    and(eq(nextOf.status, "ACTIVE"), gt(nextOf.endsAt, grantOf.endsAt)),
                  ),
                ),
              ),
          ),
          notExists(
            this.#db
              .select({ one: sql`1` })
              .from(storeOf)
              .where(
                and(
                  eq(storeOf.userId, grantOf.userId),
                  isNull(storeOf.deletedAt),
                  inArray(storeOf.status, ["ACTIVE", "CANCELLED"]),
                  or(
                    gte(storeOf.expiresAt, grantOf.endsAt),
                    gte(storeOf.gracePeriodEndsAt, grantOf.endsAt),
                  ),
                ),
              ),
          ),
          params.after == null
            ? undefined
            : tupleGreaterThan(
                [grantOf.endsAt, grantOf.id],
                [params.after.endsAt, params.after.id.value],
              ),
        ),
      )
      .orderBy(grantOf.endsAt, grantOf.id)
      .limit(params.limit);
    return rows.flatMap((row) =>
      row.endsAt == null ? [] : [toPremiumGrantEndingNotice({ ...row, endsAt: row.endsAt })],
    );
  }

  async claim(
    notices: readonly PremiumGrantEndingNotice[],
    claimedAt: Temporal.Instant,
  ): Promise<PremiumGrantEndingNotice[]> {
    if (notices.length === 0) {
      return [];
    }
    const claimed = await this.#db
      .update(premiumGrant)
      .set({ endingNotifiedAt: claimedAt, updatedAt: claimedAt })
      .where(
        and(
          inArray(
            premiumGrant.id,
            notices.map((notice) => notice.id.value),
          ),
          isNull(premiumGrant.endingNotifiedAt),
          eq(premiumGrant.status, "ACTIVE"),
        ),
      )
      .returning({ id: premiumGrant.id });
    const claimedIds = new Set(claimed.map((row) => row.id));
    return notices.filter((notice) => claimedIds.has(notice.id.value));
  }
}
