import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import type { UserConsent } from "#api/platform/database/database.types";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  ConsentSeedInput,
  UserConsentRepositoryPort,
} from "../../../application/ports/settings/user-consent.repository.port.js";

@Injectable()
export class UserConsentRepository implements UserConsentRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async findByUserId(userId: string): Promise<UserConsent | null> {
    return this.client.orm.public.UserConsent.where((row) => row.userId.eq(userId))
      .first()
      .then((row) => decodeRecord("UserConsent", row));
  }

  async findByUserIds(userIds: readonly string[]): Promise<UserConsent[]> {
    if (userIds.length === 0) return [];
    return this.client.orm.public.UserConsent.where((row) => row.userId.in([...userIds]))
      .all()
      .then((rows) => decodeRecord("UserConsent", rows));
  }

  async create(userId: string, data: ConsentSeedInput): Promise<UserConsent> {
    return this.client.orm.public.UserConsent.create(
      encodeCreate("UserConsent", {
        userId,
        termsAgreedAt: data.termsAgreedAt ?? null,
        privacyAgreedAt: data.privacyAgreedAt ?? null,
        agreedTermsVersion: data.agreedTermsVersion ?? null,
        marketingAgreedAt: data.marketingAgreedAt ?? null,
        marketingPushAgreedAt: data.marketingPushAgreedAt ?? null,
      }),
    ).then((row) => decodeRecord("UserConsent", row));
  }

  async upsertMarketingConsent(
    userId: string,
    data: { agreedAt: Date | null },
  ): Promise<UserConsent> {
    return this.client.orm.public.UserConsent.where((row) => row.userId.eq(userId))
      .upsert({
        conflictOn: encodePatch("UserConsent", { userId }),
        create: encodeCreate("UserConsent", { userId, marketingAgreedAt: data.agreedAt }),
        update: encodePatch("UserConsent", { marketingAgreedAt: data.agreedAt }),
      })
      .then((row) => decodeRecord("UserConsent", row));
  }

  async upsertMarketingPushConsent(
    userId: string,
    data: { agreedAt: Date | null },
  ): Promise<UserConsent> {
    return this.client.orm.public.UserConsent.where((row) => row.userId.eq(userId))
      .upsert({
        conflictOn: encodePatch("UserConsent", { userId }),
        create: encodeCreate("UserConsent", { userId, marketingPushAgreedAt: data.agreedAt }),
        update: encodePatch("UserConsent", { marketingPushAgreedAt: data.agreedAt }),
      })
      .then((row) => decodeRecord("UserConsent", row));
  }
}
