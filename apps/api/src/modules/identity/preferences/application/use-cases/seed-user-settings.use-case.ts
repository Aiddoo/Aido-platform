import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type ConsentSeedInput,
  type UserConsentRepositoryPort,
} from "../ports/user-consent.repository.port.js";
import { type UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";

export interface SeedUserSettingsCommand {
  readonly userId: string;
  readonly consent: ConsentSeedInput;
}

interface SeedUserSettingsDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "create">;
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "create">;
}

export class SeedUserSettingsUseCase {
  readonly #dependencies: SeedUserSettingsDependencies;

  constructor(dependencies: SeedUserSettingsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SeedUserSettingsCommand): Promise<void> {
    const userId = UserId.reconstitute(input.userId);
    // Auth 프로비저닝이 연 CLS transaction에 참여한다.
    await this.#dependencies.consentRepository.create(userId, input.consent);
    await this.#dependencies.preferenceRepository.create(userId, {
      pushEnabled: true,
      nightPushEnabled: true,
    });
  }
}
