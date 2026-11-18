import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import {
  toMarketingConsentReadModel,
  type MarketingConsentReadModel,
} from "../read-models/consent.read-model.js";
import { UserPreferenceLockKeys } from "../user-preferences.lock-keys.js";
import { UserPreferenceLogEvent } from "../user-preferences.log-events.js";

export interface UpdateMarketingConsentCommand {
  readonly userId: string;
  readonly agreed: boolean;
}

interface UpdateMarketingConsentDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "getByUserId" | "save">;
  readonly mutationLock: Pick<MutationLockPort, "acquire">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class UpdateMarketingConsentUseCase {
  readonly #dependencies: UpdateMarketingConsentDependencies;

  constructor(dependencies: UpdateMarketingConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateMarketingConsentCommand): Promise<MarketingConsentReadModel> {
    const userId = UserId.reconstitute(input.userId);
    const processedAt = this.#dependencies.clock.now();
    const { preferenceRepository } = this.#dependencies;
    const consent = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([UserPreferenceLockKeys.preference(userId)]);
      const preference = await preferenceRepository.getByUserId(userId);
      if (preference.changeMarketingConsent(input.agreed, processedAt)) {
        await preferenceRepository.save(preference);
      }
      return preference.consent.toPrimitives();
    });
    this.#dependencies.logger.log({
      event: UserPreferenceLogEvent.MARKETING_CONSENT_UPDATED,
      userId: input.userId,
      agreed: input.agreed,
    });
    return toMarketingConsentReadModel(consent, processedAt);
  }
}
