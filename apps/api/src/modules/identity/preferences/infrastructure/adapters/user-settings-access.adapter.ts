import { Inject, Injectable } from "@nestjs/common";

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

  seedDefaults(userId: string, consent: ConsentSeedInput): Promise<void> {
    return this.#seedUserSettingsUseCase.execute({ userId, consent });
  }

  recordTodoToggle(userId: string, completed: boolean, timezone: string): Promise<void> {
    return this.#onTodoToggledUseCase.execute({ userId, completed, timezone });
  }

  getPreferenceRecord(userId: string) {
    return this.#getPreferenceRecordUseCase.execute({ userId });
  }

  async findStoredTimezone(userId: string): Promise<string | null> {
    const record = await this.#getPreferenceRecordUseCase.execute({ userId });
    return record?.timezone ?? null;
  }

  getPreferenceRecordsByUserIds(userIds: string[]) {
    return this.#getPreferenceRecordsUseCase.execute({ userIds });
  }

  getConsentRecord(userId: string) {
    return this.#getConsentRecordUseCase.execute({ userId });
  }

  getConsentRecordsByUserIds(userIds: string[]) {
    return this.#getConsentRecordsUseCase.execute({ userIds });
  }

  upsertPushTimezone(userId: string, timezone: string): Promise<void> {
    return this.#upsertPushTimezoneUseCase.execute({ userId, timezone });
  }

  upsertPushLocale(userId: string, locale: string): Promise<void> {
    return this.#upsertPushLocaleUseCase.execute({ userId, locale });
  }

  async updateMarketingPushConsent(userId: string, agreed: boolean): Promise<void> {
    await this.#updateMarketingPushConsentUseCase.execute({ userId, agreed });
  }

  findMarketingReconfirmTargets(
    params: FindMarketingReconfirmTargetsParams,
  ): Promise<MarketingReconfirmTarget[]> {
    return this.#consentRepository.findMarketingReconfirmTargets(params);
  }

  claimMarketingReconfirm(
    userIds: readonly string[],
    params: { readonly cutoff: Temporal.Instant; readonly at: Temporal.Instant },
  ): Promise<MarketingReconfirmTarget[]> {
    return this.#consentRepository.claimMarketingReconfirm(userIds, params);
  }
}
