import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { userConsent } from "#api/platform/database/schema/index";

import type {
  ConsentSeedInput,
  UserConsentRepositoryPort,
} from "../../../application/ports/settings/user-consent.repository.port.js";

type UserConsentRow = typeof userConsent.$inferSelect;
type UserConsentPatch = Partial<Omit<typeof userConsent.$inferInsert, "id" | "userId">>;

@Injectable()
export class DrizzleUserConsentRepository implements UserConsentRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async findByUserId(userId: string): Promise<UserConsentRow | null> {
    const row = await this.db.query.userConsent.findFirst({ where: { userId } });
    return row ?? null;
  }

  async findByUserIds(userIds: readonly string[]): Promise<UserConsentRow[]> {
    if (userIds.length === 0) {
      return [];
    }
    return this.db.query.userConsent.findMany({ where: { userId: { in: [...userIds] } } });
  }

  async create(userId: string, data: ConsentSeedInput): Promise<UserConsentRow> {
    const [row] = await this.db
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
    data: { agreedAt: Date | null },
  ): Promise<UserConsentRow> {
    return this.upsert(userId, { marketingAgreedAt: data.agreedAt });
  }

  async upsertMarketingPushConsent(
    userId: string,
    data: { agreedAt: Date | null },
  ): Promise<UserConsentRow> {
    return this.upsert(userId, { marketingPushAgreedAt: data.agreedAt });
  }

  async upsertAiDataSharingConsent(
    userId: string,
    data: { agreedAt: Date | null; version: string },
  ): Promise<UserConsentRow> {
    return this.upsert(userId, {
      aiDataSharingAgreedAt: data.agreedAt,
      aiDataSharingVersion: data.version,
    });
  }

  private async upsert(userId: string, patch: UserConsentPatch): Promise<UserConsentRow> {
    const [row] = await this.db
      .insert(userConsent)
      .values({ userId, ...patch })
      .onConflictDoUpdate({ target: userConsent.userId, set: patch })
      .returning();
    return requireRecord(row);
  }
}
