import { minBy } from "es-toolkit";

import {
  type FindMarketingReconfirmTargetsParams,
  type MarketingReconfirmTarget,
  UserConsentRepositoryPort,
} from "#api/modules/identity/user-preferences/application/ports/user-consent.repository.port";
import type { UserConsentReadModel } from "#api/modules/identity/user-preferences/application/read-models/consent.read-model";
import { AiDataSharingConsent } from "#api/modules/identity/user-preferences/domain/ai-data-sharing-consent.entity";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

const EMPTY_CONSENT: Omit<UserConsentReadModel, "userId"> = {
  termsAgreedAt: null,
  privacyAgreedAt: null,
  agreedTermsVersion: null,
  marketingAgreedAt: null,
  marketingPushAgreedAt: null,
  aiDataSharingAgreedAt: null,
  aiDataSharingVersion: null,
  marketingReconfirmedAt: null,
};

function copyOf(record: UserConsentReadModel): UserConsentReadModel {
  return { ...record };
}

function toTarget(record: UserConsentReadModel): MarketingReconfirmTarget {
  return {
    userId: record.userId,
    marketingAgreedAt: record.marketingAgreedAt,
    marketingPushAgreedAt: record.marketingPushAgreedAt,
  };
}

// Drizzle 저장소의 COALESCE(재확인 시각, LEAST(두 동의 시각)) <= cutoff와 같다
function isReconfirmDue(record: UserConsentReadModel, cutoff: Temporal.Instant): boolean {
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
  readonly #records = new Map<string, UserConsentReadModel>();
  // Drizzle 저장소는 User 행과 조인해 탈퇴·비활성 사용자를 재확인 대상에서 뺀다
  readonly #inactiveUserIds: ReadonlySet<string>;

  constructor(
    options: {
      readonly records?: readonly UserConsentReadModel[];
      readonly inactiveUserIds?: readonly string[];
    } = {},
  ) {
    super();
    for (const record of options.records ?? []) {
      this.#records.set(record.userId, copyOf(record));
    }
    this.#inactiveUserIds = new Set(options.inactiveUserIds ?? []);
  }

  get all(): readonly UserConsentReadModel[] {
    return [...this.#records.values()].map(copyOf);
  }

  stored(userId: string): UserConsentReadModel | undefined {
    const record = this.#records.get(userId);
    return record == null ? undefined : copyOf(record);
  }

  async findByUserId(userId: UserId): Promise<UserConsentReadModel | null> {
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

  async findByUserIds(userIds: readonly UserId[]): Promise<UserConsentReadModel[]> {
    return this.all.filter((record) => userIds.some((userId) => userId.value === record.userId));
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

  // UserPreference 저장이 바꾼 동의 칸을 넣거나 바꾼다(Drizzle의 UserConsent upsert와 같다)
  merge(userId: string, patch: Partial<Omit<UserConsentReadModel, "userId">>): void {
    this.#upsert(userId, patch);
  }

  #upsert(
    userId: string,
    patch: Partial<Omit<UserConsentReadModel, "userId">>,
  ): UserConsentReadModel {
    return this.#write({
      ...(this.#records.get(userId) ?? { ...EMPTY_CONSENT, userId }),
      ...patch,
    });
  }

  #write(record: UserConsentReadModel): UserConsentReadModel {
    this.#records.set(record.userId, copyOf(record));
    return copyOf(record);
  }
}
