import { minBy } from "es-toolkit";

import {
  type ConsentSeedInput,
  type FindMarketingReconfirmTargetsParams,
  type MarketingReconfirmTarget,
  type UserConsentRecordWithId,
  UserConsentRepositoryPort,
} from "#api/modules/identity/preferences/application/ports/user-consent.repository.port";
import { AiDataSharingConsent } from "#api/modules/identity/preferences/domain/ai-data-sharing-consent.entity";
import type { UserConsentRecord } from "#api/modules/identity/preferences/domain/user-consent.constants";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

const EMPTY_CONSENT: UserConsentRecord = {
  termsAgreedAt: null,
  privacyAgreedAt: null,
  agreedTermsVersion: null,
  marketingAgreedAt: null,
  marketingPushAgreedAt: null,
  aiDataSharingAgreedAt: null,
  aiDataSharingVersion: null,
  marketingReconfirmedAt: null,
};

function copyOf(record: UserConsentRecordWithId): UserConsentRecordWithId {
  return { ...record };
}

function toTarget(record: UserConsentRecordWithId): MarketingReconfirmTarget {
  return {
    userId: record.userId,
    marketingAgreedAt: record.marketingAgreedAt,
    marketingPushAgreedAt: record.marketingPushAgreedAt,
  };
}

// Drizzle 저장소의 COALESCE(재확인 시각, LEAST(두 동의 시각)) <= cutoff와 같다
function isReconfirmDue(record: UserConsentRecord, cutoff: Temporal.Instant): boolean {
  const earliestAgreedAt = minBy(
    [record.marketingAgreedAt, record.marketingPushAgreedAt].flatMap((instant) =>
      instant == null ? [] : [instant],
    ),
    (instant) => instant.epochMilliseconds,
  );
  if (earliestAgreedAt == null) {
    return false;
  }
  return Temporal.Instant.compare(record.marketingReconfirmedAt ?? earliestAgreedAt, cutoff) <= 0;
}

export class InMemoryUserConsentRepository extends UserConsentRepositoryPort {
  readonly #records = new Map<string, UserConsentRecordWithId>();
  // Drizzle 저장소는 User 행과 조인해 탈퇴·비활성 사용자를 재확인 대상에서 뺀다
  readonly #inactiveUserIds: ReadonlySet<string>;

  constructor(
    options: {
      readonly records?: readonly UserConsentRecordWithId[];
      readonly inactiveUserIds?: readonly string[];
    } = {},
  ) {
    super();
    for (const record of options.records ?? []) {
      this.#records.set(record.userId, copyOf(record));
    }
    this.#inactiveUserIds = new Set(options.inactiveUserIds ?? []);
  }

  get all(): readonly UserConsentRecordWithId[] {
    return [...this.#records.values()].map(copyOf);
  }

  stored(userId: string): UserConsentRecordWithId | undefined {
    const record = this.#records.get(userId);
    return record == null ? undefined : copyOf(record);
  }

  async findByUserId(userId: UserId): Promise<UserConsentRecordWithId | null> {
    return this.stored(userId.value) ?? null;
  }

  async findAiDataSharingConsent(userId: UserId): Promise<AiDataSharingConsent> {
    const record = this.#records.get(userId.value);
    return AiDataSharingConsent.reconstitute({
      userId: userId.value,
      agreedAt: record?.aiDataSharingAgreedAt ?? null,
      version: record?.aiDataSharingVersion ?? null,
    });
  }

  async findByUserIds(userIds: readonly UserId[]): Promise<UserConsentRecordWithId[]> {
    return this.all.filter((record) => userIds.some((userId) => userId.value === record.userId));
  }

  async create(userId: UserId, data: ConsentSeedInput): Promise<UserConsentRecordWithId> {
    if (this.#records.has(userId.value)) {
      throw new Error(`UserConsent already exists for ${userId.value}`);
    }
    return this.#write({
      ...EMPTY_CONSENT,
      userId: userId.value,
      termsAgreedAt: data.termsAgreedAt ?? null,
      privacyAgreedAt: data.privacyAgreedAt ?? null,
      agreedTermsVersion: data.agreedTermsVersion ?? null,
      marketingAgreedAt: data.marketingAgreedAt ?? null,
      marketingPushAgreedAt: data.marketingPushAgreedAt ?? null,
    });
  }

  async upsertMarketingConsent(
    userId: UserId,
    data: { agreedAt: Temporal.Instant | null },
  ): Promise<UserConsentRecordWithId> {
    return this.#upsert(userId.value, { marketingAgreedAt: data.agreedAt });
  }

  async upsertMarketingPushConsent(
    userId: UserId,
    data: { agreedAt: Temporal.Instant | null },
  ): Promise<UserConsentRecordWithId> {
    return this.#upsert(userId.value, { marketingPushAgreedAt: data.agreedAt });
  }

  async findMarketingReconfirmTargets(
    params: FindMarketingReconfirmTargetsParams,
  ): Promise<MarketingReconfirmTarget[]> {
    const { cutoff, afterUserId, limit } = params;
    return [...this.#records.values()]
      .filter(
        (record) =>
          isReconfirmDue(record, cutoff) &&
          !this.#inactiveUserIds.has(record.userId) &&
          (afterUserId == null || record.userId > afterUserId.value),
      )
      .toSorted((left, right) => (left.userId < right.userId ? -1 : 1))
      .slice(0, limit)
      .map(toTarget);
  }

  async claimMarketingReconfirm(
    userIds: readonly UserId[],
    params: { readonly cutoff: Temporal.Instant; readonly at: Temporal.Instant },
  ): Promise<MarketingReconfirmTarget[]> {
    const claimed = [...this.#records.values()].filter(
      (record) =>
        userIds.some((userId) => userId.value === record.userId) &&
        isReconfirmDue(record, params.cutoff),
    );
    for (const record of claimed) {
      this.#write({ ...record, marketingReconfirmedAt: params.at });
    }
    return claimed.map(toTarget);
  }

  async upsertAiDataSharingConsent(
    userId: UserId,
    data: { agreedAt: Temporal.Instant | null; version: string },
  ): Promise<UserConsentRecordWithId> {
    return this.#upsert(userId.value, {
      aiDataSharingAgreedAt: data.agreedAt,
      aiDataSharingVersion: data.version,
    });
  }

  #upsert(userId: string, patch: Partial<UserConsentRecord>): UserConsentRecordWithId {
    return this.#write({
      ...(this.#records.get(userId) ?? { ...EMPTY_CONSENT, userId }),
      ...patch,
    });
  }

  #write(record: UserConsentRecordWithId): UserConsentRecordWithId {
    this.#records.set(record.userId, copyOf(record));
    return copyOf(record);
  }
}
