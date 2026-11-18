import { Inject, Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type FindMarketingReconfirmTargetsParams,
  type MarketingReconfirmTarget,
  UserConsentRepositoryPort,
} from "../../application/ports/user-consent.repository.port.js";
import type {
  TodoToggle,
  UserNotificationSettingsAccessPort,
  UserSettingsProvisionerPort,
  UserStreakAccessPort,
  UserTimezoneReaderPort,
} from "../../application/ports/user-settings-access.port.js";
import { GetConsentReadModelUseCase } from "../../application/use-cases/get-consent-read-model.use-case.js";
import { GetConsentReadModelsUseCase } from "../../application/use-cases/get-consent-read-models.use-case.js";
import { GetPreferenceReadModelUseCase } from "../../application/use-cases/get-preference-read-model.use-case.js";
import { GetPreferenceReadModelsUseCase } from "../../application/use-cases/get-preference-read-models.use-case.js";
import { OnTodoToggledUseCase } from "../../application/use-cases/on-todo-toggled.use-case.js";
import { SeedUserSettingsUseCase } from "../../application/use-cases/seed-user-settings.use-case.js";
import { UpdateMarketingPushConsentUseCase } from "../../application/use-cases/update-marketing-push-consent.use-case.js";
import { UpsertPushLocaleUseCase } from "../../application/use-cases/upsert-push-locale.use-case.js";
import { UpsertPushTimezoneUseCase } from "../../application/use-cases/upsert-push-timezone.use-case.js";
import type { ConsentAgreement } from "../../domain/user-consent.entity.js";

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
  readonly #getPreferenceReadModelUseCase: GetPreferenceReadModelUseCase;
  readonly #getPreferenceReadModelsUseCase: GetPreferenceReadModelsUseCase;
  readonly #getConsentReadModelUseCase: GetConsentReadModelUseCase;
  readonly #getConsentReadModelsUseCase: GetConsentReadModelsUseCase;
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
    getPreferenceReadModelUseCase: GetPreferenceReadModelUseCase,
    getPreferenceReadModelsUseCase: GetPreferenceReadModelsUseCase,
    getConsentReadModelUseCase: GetConsentReadModelUseCase,
    getConsentReadModelsUseCase: GetConsentReadModelsUseCase,
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
    this.#getPreferenceReadModelUseCase = getPreferenceReadModelUseCase;
    this.#getPreferenceReadModelsUseCase = getPreferenceReadModelsUseCase;
    this.#getConsentReadModelUseCase = getConsentReadModelUseCase;
    this.#getConsentReadModelsUseCase = getConsentReadModelsUseCase;
    this.#upsertPushTimezoneUseCase = upsertPushTimezoneUseCase;
    this.#upsertPushLocaleUseCase = upsertPushLocaleUseCase;
    this.#updateMarketingPushConsentUseCase = updateMarketingPushConsentUseCase;
    this.#consentRepository = consentRepository;
  }

  seedDefaults(userId: UserId, consent: ConsentAgreement): Promise<void> {
    return this.#seedUserSettingsUseCase.execute({ userId: userId.value, consent });
  }

  recordTodoToggle(toggle: TodoToggle): Promise<void> {
    return this.#onTodoToggledUseCase.execute({
      userId: toggle.userId.value,
      completed: toggle.completed,
      timezone: toggle.timezone,
      todayStats: toggle.todayStats ?? undefined,
    });
  }

  findPreferenceReadModel(userId: UserId) {
    return this.#getPreferenceReadModelUseCase.execute({ userId: userId.value });
  }

  async findStoredTimezone(userId: UserId): Promise<string | null> {
    const record = await this.#getPreferenceReadModelUseCase.execute({ userId: userId.value });
    return record?.timezone ?? null;
  }

  findPreferenceReadModelsByUserIds(userIds: readonly UserId[]) {
    return this.#getPreferenceReadModelsUseCase.execute({
      userIds: userIds.map((userId) => userId.value),
    });
  }

  findConsentReadModel(userId: UserId) {
    return this.#getConsentReadModelUseCase.execute({ userId: userId.value });
  }

  findConsentReadModelsByUserIds(userIds: readonly UserId[]) {
    return this.#getConsentReadModelsUseCase.execute({
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
