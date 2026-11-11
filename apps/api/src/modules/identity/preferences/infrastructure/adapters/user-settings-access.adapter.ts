import { Inject, Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type ConsentSeedInput,
  type FindMarketingReconfirmTargetsParams,
  type MarketingReconfirmTarget,
  UserConsentRepositoryPort,
} from "../../application/ports/user-consent.repository.port.js";
import type {
  UserNotificationSettingsAccessPort,
  UserSettingsProvisionerPort,
  UserStreakAccessPort,
  UserTimezoneReaderPort,
} from "../../application/ports/user-settings-access.port.js";
import { GetConsentRecordUseCase } from "../../application/use-cases/get-consent-record.use-case.js";
import { GetConsentRecordsUseCase } from "../../application/use-cases/get-consent-records.use-case.js";
import { GetPreferenceRecordUseCase } from "../../application/use-cases/get-preference-record.use-case.js";
import { GetPreferenceRecordsUseCase } from "../../application/use-cases/get-preference-records.use-case.js";
import { OnTodoToggledUseCase } from "../../application/use-cases/on-todo-toggled.use-case.js";
import { SeedUserSettingsUseCase } from "../../application/use-cases/seed-user-settings.use-case.js";
import { UpdateMarketingPushConsentUseCase } from "../../application/use-cases/update-marketing-push-consent.use-case.js";
import { UpsertPushLocaleUseCase } from "../../application/use-cases/upsert-push-locale.use-case.js";
import { UpsertPushTimezoneUseCase } from "../../application/use-cases/upsert-push-timezone.use-case.js";

/** 외부 컨텍스트에 공개한 좁은 capability를 내부 endpoint UseCase에 연결한다. */
@Injectable()
export class UserSettingsAccessAdapter
  implements
    UserSettingsProvisionerPort,
    UserStreakAccessPort,
    UserNotificationSettingsAccessPort,
    UserTimezoneReaderPort
{
  readonly #seedUserSettingsUseCase: SeedUserSettingsUseCase;
  readonly #onTodoToggledUseCase: OnTodoToggledUseCase;
  readonly #getPreferenceRecordUseCase: GetPreferenceRecordUseCase;
  readonly #getPreferenceRecordsUseCase: GetPreferenceRecordsUseCase;
  readonly #getConsentRecordUseCase: GetConsentRecordUseCase;
  readonly #getConsentRecordsUseCase: GetConsentRecordsUseCase;
  readonly #upsertPushTimezoneUseCase: UpsertPushTimezoneUseCase;
  readonly #upsertPushLocaleUseCase: UpsertPushLocaleUseCase;
  readonly #updateMarketingPushConsentUseCase: UpdateMarketingPushConsentUseCase;
  readonly #consentRepository: Pick<
    UserConsentRepositoryPort,
    "findMarketingReconfirmTargets" | "claimMarketingReconfirm"
  >;

  constructor(
    seedUserSettingsUseCase: SeedUserSettingsUseCase,
    onTodoToggledUseCase: OnTodoToggledUseCase,
    getPreferenceRecordUseCase: GetPreferenceRecordUseCase,
    getPreferenceRecordsUseCase: GetPreferenceRecordsUseCase,
    getConsentRecordUseCase: GetConsentRecordUseCase,
    getConsentRecordsUseCase: GetConsentRecordsUseCase,
    upsertPushTimezoneUseCase: UpsertPushTimezoneUseCase,
    upsertPushLocaleUseCase: UpsertPushLocaleUseCase,
    updateMarketingPushConsentUseCase: UpdateMarketingPushConsentUseCase,
    @Inject(UserConsentRepositoryPort)
    consentRepository: Pick<
      UserConsentRepositoryPort,
      "findMarketingReconfirmTargets" | "claimMarketingReconfirm"
    >,
  ) {
    this.#seedUserSettingsUseCase = seedUserSettingsUseCase;
    this.#onTodoToggledUseCase = onTodoToggledUseCase;
    this.#getPreferenceRecordUseCase = getPreferenceRecordUseCase;
    this.#getPreferenceRecordsUseCase = getPreferenceRecordsUseCase;
    this.#getConsentRecordUseCase = getConsentRecordUseCase;
    this.#getConsentRecordsUseCase = getConsentRecordsUseCase;
    this.#upsertPushTimezoneUseCase = upsertPushTimezoneUseCase;
    this.#upsertPushLocaleUseCase = upsertPushLocaleUseCase;
    this.#updateMarketingPushConsentUseCase = updateMarketingPushConsentUseCase;
    this.#consentRepository = consentRepository;
  }

  seedDefaults(userId: UserId, consent: ConsentSeedInput): Promise<void> {
    return this.#seedUserSettingsUseCase.execute({ userId: userId.value, consent });
  }

  recordTodoToggle(userId: UserId, completed: boolean, timezone: string): Promise<void> {
    return this.#onTodoToggledUseCase.execute({ userId: userId.value, completed, timezone });
  }

  getPreferenceRecord(userId: UserId) {
    return this.#getPreferenceRecordUseCase.execute({ userId: userId.value });
  }

  async findStoredTimezone(userId: UserId): Promise<string | null> {
    const record = await this.#getPreferenceRecordUseCase.execute({ userId: userId.value });
    return record?.timezone ?? null;
  }

  getPreferenceRecordsByUserIds(userIds: readonly UserId[]) {
    return this.#getPreferenceRecordsUseCase.execute({
      userIds: userIds.map((userId) => userId.value),
    });
  }

  getConsentRecord(userId: UserId) {
    return this.#getConsentRecordUseCase.execute({ userId: userId.value });
  }

  getConsentRecordsByUserIds(userIds: readonly UserId[]) {
    return this.#getConsentRecordsUseCase.execute({
      userIds: userIds.map((userId) => userId.value),
    });
  }

  upsertPushTimezone(userId: UserId, timezone: string): Promise<void> {
    return this.#upsertPushTimezoneUseCase.execute({ userId: userId.value, timezone });
  }

  upsertPushLocale(userId: UserId, locale: string): Promise<void> {
    return this.#upsertPushLocaleUseCase.execute({ userId: userId.value, locale });
  }

  async updateMarketingPushConsent(userId: UserId, agreed: boolean): Promise<void> {
    await this.#updateMarketingPushConsentUseCase.execute({ userId: userId.value, agreed });
  }

  findMarketingReconfirmTargets(
    params: FindMarketingReconfirmTargetsParams,
  ): Promise<MarketingReconfirmTarget[]> {
    return this.#consentRepository.findMarketingReconfirmTargets(params);
  }

  claimMarketingReconfirm(
    userIds: readonly UserId[],
    params: { readonly cutoff: Temporal.Instant; readonly at: Temporal.Instant },
  ): Promise<MarketingReconfirmTarget[]> {
    return this.#consentRepository.claimMarketingReconfirm(userIds, params);
  }
}
