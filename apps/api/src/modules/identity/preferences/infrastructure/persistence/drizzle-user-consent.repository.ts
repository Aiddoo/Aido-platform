import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray, isNotNull, isNull, or, type SQL, sql } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { user, userConsent } from "#api/platform/database/schema/index";

import {
  type ConsentSeedInput,
  type FindMarketingReconfirmTargetsParams,
  type MarketingReconfirmTarget,
  UserConsentRepositoryPort,
} from "../../application/ports/user-consent.repository.port.js";

/** 광고성 동의가 있고, 마지막 재확인(없으면 처음 동의)이 cutoff 이전이다. LEAST는 NULL을 건너뛴다 */
function marketingReconfirmDue(cutoff: Temporal.Instant): SQL | undefined {
  return and(
    or(isNotNull(userConsent.marketingAgreedAt), isNotNull(userConsent.marketingPushAgreedAt)),
    sql`COALESCE(${userConsent.marketingReconfirmedAt}, LEAST(${userConsent.marketingAgreedAt}, ${userConsent.marketingPushAgreedAt})) <= ${sql.param(cutoff, userConsent.marketingReconfirmedAt)}`,
  );
}

const reconfirmTargetColumns = {
  userId: userConsent.userId,
  marketingAgreedAt: userConsent.marketingAgreedAt,
  marketingPushAgreedAt: userConsent.marketingPushAgreedAt,
};

type UserConsentRow = typeof userConsent.$inferSelect;
type UserConsentPatch = Partial<Omit<typeof userConsent.$inferInsert, "id" | "userId">>;

import { AiDataSharingConsent } from "../../domain/ai-data-sharing-consent.entity.js";

@Injectable()
export class DrizzleUserConsentRepository extends UserConsentRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findByUserId(userId: string): Promise<UserConsentRow | null> {
    const row = await this.#db.query.userConsent.findFirst({ where: { userId } });
    return row ?? null;
  }

  async findAiDataSharingConsent(userId: string): Promise<AiDataSharingConsent> {
    const row = await this.#db.query.userConsent.findFirst({
      columns: { aiDataSharingAgreedAt: true, aiDataSharingVersion: true },
      where: { userId },
    });
    return AiDataSharingConsent.reconstitute({
      userId,
      agreedAt: row?.aiDataSharingAgreedAt ?? null,
      version: row?.aiDataSharingVersion ?? null,
    });
  }

  async findByUserIds(userIds: readonly string[]): Promise<UserConsentRow[]> {
    if (userIds.length === 0) {
      return [];
    }
    return this.#db.query.userConsent.findMany({ where: { userId: { in: [...userIds] } } });
  }

  async create(userId: string, data: ConsentSeedInput): Promise<UserConsentRow> {
    const [row] = await this.#db
      .insert(userConsent)
      .values({
        userId,
        termsAgreedAt: data.termsAgreedAt ?? null,
        privacyAgreedAt: data.privacyAgreedAt ?? null,
        agreedTermsVersion: data.agreedTermsVersion ?? null,
        marketingAgreedAt: data.marketingAgreedAt ?? null,
        marketingPushAgreedAt: data.marketingPushAgreedAt ?? null,
      })
      .returning();
    return requireRecord(row);
  }

  async upsertMarketingConsent(
    userId: string,
    data: { agreedAt: Temporal.Instant | null },
  ): Promise<UserConsentRow> {
    return this.#upsert(userId, { marketingAgreedAt: data.agreedAt });
  }

  async upsertMarketingPushConsent(
    userId: string,
    data: { agreedAt: Temporal.Instant | null },
  ): Promise<UserConsentRow> {
    return this.#upsert(userId, { marketingPushAgreedAt: data.agreedAt });
  }

  async findMarketingReconfirmTargets(
    params: FindMarketingReconfirmTargetsParams,
  ): Promise<MarketingReconfirmTarget[]> {
    return this.#db
      .select(reconfirmTargetColumns)
      .from(userConsent)
      .innerJoin(user, eq(user.id, userConsent.userId))
      .where(
        and(
          marketingReconfirmDue(params.cutoff),
          isNull(user.deletedAt),
          eq(user.status, "ACTIVE"),
          params.afterUserId == null ? undefined : gt(userConsent.userId, params.afterUserId),
        ),
      )
      .orderBy(asc(userConsent.userId))
      .limit(params.limit);
  }

  async claimMarketingReconfirm(
    userIds: readonly string[],
    params: { readonly cutoff: Temporal.Instant; readonly at: Temporal.Instant },
  ): Promise<MarketingReconfirmTarget[]> {
    if (userIds.length === 0) {
      return [];
    }
    return this.#db
      .update(userConsent)
      .set({ marketingReconfirmedAt: params.at })
      .where(and(inArray(userConsent.userId, [...userIds]), marketingReconfirmDue(params.cutoff)))
      .returning(reconfirmTargetColumns);
  }

  async upsertAiDataSharingConsent(
    userId: string,
    data: { agreedAt: Temporal.Instant | null; version: string },
  ): Promise<UserConsentRow> {
    return this.#upsert(userId, {
      aiDataSharingAgreedAt: data.agreedAt,
      aiDataSharingVersion: data.version,
    });
  }

  async #upsert(userId: string, patch: UserConsentPatch): Promise<UserConsentRow> {
    const [row] = await this.#db
      .insert(userConsent)
      .values({ userId, ...patch })
      .onConflictDoUpdate({ target: userConsent.userId, set: patch })
      .returning();
    return requireRecord(row);
  }
}
