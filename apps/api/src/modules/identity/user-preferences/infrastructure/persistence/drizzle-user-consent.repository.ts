import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray, isNotNull, isNull, or, type SQL, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { user, userConsent } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
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

import type { UserConsentReadModel } from "../../application/read-models/consent.read-model.js";
import { AiDataSharingConsent } from "../../domain/ai-data-sharing-consent.entity.js";

type UserConsentRow = typeof userConsent.$inferSelect;

function toMarketingReconfirmTarget(row: {
  readonly userId: string;
  readonly marketingAgreedAt: Temporal.Instant | null;
  readonly marketingPushAgreedAt: Temporal.Instant | null;
}): MarketingReconfirmTarget {
  return { ...row, userId: UserId.reconstitute(row.userId) };
}

function toUserConsentReadModel(row: UserConsentRow): UserConsentReadModel {
  return {
    userId: row.userId,
    termsAgreedAt: row.termsAgreedAt,
    privacyAgreedAt: row.privacyAgreedAt,
    agreedTermsVersion: row.agreedTermsVersion,
    marketingAgreedAt: row.marketingAgreedAt,
    marketingPushAgreedAt: row.marketingPushAgreedAt,
    aiDataSharingAgreedAt: row.aiDataSharingAgreedAt,
    aiDataSharingVersion: row.aiDataSharingVersion,
    marketingReconfirmedAt: row.marketingReconfirmedAt,
  };
}

@Injectable()
export class DrizzleUserConsentRepository extends UserConsentRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#transactionHost = transactionHost;
  }

  async findByUserId(userId: UserId): Promise<UserConsentReadModel | null> {
    const row = await this.#db.query.userConsent.findFirst({ where: { userId: userId.value } });
    return row == null ? null : toUserConsentReadModel(row);
  }

  async getAiDataSharingConsent(userId: UserId): Promise<AiDataSharingConsent> {
    const row = await this.#db.query.userConsent.findFirst({
      columns: { aiDataSharingAgreedAt: true, aiDataSharingVersion: true },
      where: { userId: userId.value },
    });
    return AiDataSharingConsent.reconstitute({
      userId: userId.value,
      agreedAt: row?.aiDataSharingAgreedAt ?? null,
      version: row?.aiDataSharingVersion ?? null,
    });
  }

  async findByUserIds(userIds: readonly UserId[]): Promise<UserConsentReadModel[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.#db.query.userConsent.findMany({
      where: { userId: { in: userIds.map((userId) => userId.value) } },
    });
    return rows.map(toUserConsentReadModel);
  }

  async findMarketingReconfirmTargets(
    params: FindMarketingReconfirmTargetsParams,
  ): Promise<MarketingReconfirmTarget[]> {
    const rows = await this.#db
      .select(reconfirmTargetColumns)
      .from(userConsent)
      .innerJoin(user, eq(user.id, userConsent.userId))
      .where(
        and(
          marketingReconfirmDue(params.cutoff),
          isNull(user.deletedAt),
          eq(user.status, "ACTIVE"),
          params.afterUserId == null ? undefined : gt(userConsent.userId, params.afterUserId.value),
        ),
      )
      .orderBy(asc(userConsent.userId))
      .limit(params.limit);
    return rows.map(toMarketingReconfirmTarget);
  }

  async claimMarketingReconfirm(
    userIds: readonly UserId[],
    params: { readonly cutoff: Temporal.Instant; readonly at: Temporal.Instant },
  ): Promise<MarketingReconfirmTarget[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.#db
      .update(userConsent)
      .set({ marketingReconfirmedAt: params.at })
      .where(
        and(
          inArray(
            userConsent.userId,
            userIds.map((userId) => userId.value),
          ),
          marketingReconfirmDue(params.cutoff),
        ),
      )
      .returning(reconfirmTargetColumns);
    return rows.map(toMarketingReconfirmTarget);
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
