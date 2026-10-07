import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { now } from "#api/shared/domain/date/utils/core";
import {
  decodeRecord,
  encodeCreate,
  encodePatch,
} from "#api/shared/infrastructure/database/database-records";
import type { UserConsent } from "#api/shared/infrastructure/database/database.types";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import type { UserConsentRepositoryPort } from "../../application/ports/user-consent.repository.port.js";

export interface CreateConsentData {
  termsAgreedAt?: Date;
  privacyAgreedAt?: Date;
  agreedTermsVersion?: string;
  marketingAgreedAt?: Date | null;
  marketingPushAgreedAt?: Date | null;
}

export interface UpdateMarketingConsentData {
  agreed: boolean;
}

@Injectable()
export class UserConsentRepository implements UserConsentRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  /** 활성 트랜잭션(없으면 베이스 클라이언트) */
  private get client() {
    return this.txHost.tx;
  }

  async findByUserId(userId: string): Promise<UserConsent | null> {
    return this.client.orm.public.UserConsent.where((row) => row.userId.eq(userId))
      .first()
      .then((row) => decodeRecord("UserConsent", row));
  }

  async create(userId: string, data?: Partial<CreateConsentData>): Promise<UserConsent> {
    return this.client.orm.public.UserConsent.create(
      encodeCreate("UserConsent", {
        userId,
        termsAgreedAt: data?.termsAgreedAt ?? null,
        privacyAgreedAt: data?.privacyAgreedAt ?? null,
        agreedTermsVersion: data?.agreedTermsVersion ?? null,
        marketingAgreedAt: data?.marketingAgreedAt ?? null,
        marketingPushAgreedAt: data?.marketingPushAgreedAt ?? null,
      }),
    ).then((row) => decodeRecord("UserConsent", row));
  }

  async upsert(userId: string, data: CreateConsentData): Promise<UserConsent> {
    return this.client.orm.public.UserConsent.where((row) => row.userId.eq(userId))
      .upsert({
        conflictOn: encodePatch("UserConsent", { userId }),
        create: encodeCreate("UserConsent", {
          userId,
          termsAgreedAt: data.termsAgreedAt ?? null,
          privacyAgreedAt: data.privacyAgreedAt ?? null,
          agreedTermsVersion: data.agreedTermsVersion ?? null,
          marketingAgreedAt: data.marketingAgreedAt ?? null,
          marketingPushAgreedAt: data.marketingPushAgreedAt ?? null,
        }),
        update: encodePatch("UserConsent", {
          ...(data.termsAgreedAt !== undefined && {
            termsAgreedAt: data.termsAgreedAt,
          }),
          ...(data.privacyAgreedAt !== undefined && {
            privacyAgreedAt: data.privacyAgreedAt,
          }),
          ...(data.agreedTermsVersion !== undefined && {
            agreedTermsVersion: data.agreedTermsVersion,
          }),
          ...(data.marketingAgreedAt !== undefined && {
            marketingAgreedAt: data.marketingAgreedAt,
          }),
          ...(data.marketingPushAgreedAt !== undefined && {
            marketingPushAgreedAt: data.marketingPushAgreedAt,
          }),
        }),
      })
      .then((row) => decodeRecord("UserConsent", row));
  }

  // agreed: true면 현재 시간으로 설정, false면 null (철회)
  async updateMarketingConsent(
    userId: string,
    data: UpdateMarketingConsentData,
  ): Promise<UserConsent> {
    return this.client.orm.public.UserConsent.where((row) => row.userId.eq(userId))
      .update(
        encodePatch("UserConsent", {
          marketingAgreedAt: data.agreed ? now() : null,
        }),
      )
      .then((row) => decodeRecord("UserConsent", requireRecord(row)));
  }

  async upsertMarketingConsent(
    userId: string,
    data: UpdateMarketingConsentData,
  ): Promise<UserConsent> {
    return this.client.orm.public.UserConsent.where((row) => row.userId.eq(userId))
      .upsert({
        conflictOn: encodePatch("UserConsent", { userId }),
        create: encodeCreate("UserConsent", {
          userId,
          marketingAgreedAt: data.agreed ? now() : null,
        }),
        update: encodePatch("UserConsent", {
          marketingAgreedAt: data.agreed ? now() : null,
        }),
      })
      .then((row) => decodeRecord("UserConsent", row));
  }

  async upsertMarketingPushConsent(
    userId: string,
    data: UpdateMarketingConsentData,
  ): Promise<UserConsent> {
    return this.client.orm.public.UserConsent.where((row) => row.userId.eq(userId))
      .upsert({
        conflictOn: encodePatch("UserConsent", { userId }),
        create: encodeCreate("UserConsent", {
          userId,
          marketingPushAgreedAt: data.agreed ? now() : null,
        }),
        update: encodePatch("UserConsent", {
          marketingPushAgreedAt: data.agreed ? now() : null,
        }),
      })
      .then((row) => decodeRecord("UserConsent", row));
  }

  /**
   * 여러 사용자의 동의 정보 배치 조회 (N+1 방지용)
   */
  async findByUserIds(userIds: string[]): Promise<UserConsent[]> {
    if (userIds.length === 0) return [];
    return this.client.orm.public.UserConsent.where((row) => row.userId.in(userIds))
      .all()
      .then((row) => decodeRecord("UserConsent", row));
  }
}
