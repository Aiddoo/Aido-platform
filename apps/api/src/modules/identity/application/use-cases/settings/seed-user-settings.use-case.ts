import {
  type ConsentSeedInput,
  type UserConsentRepositoryPort,
} from "../../ports/settings/user-consent.repository.port.js";
import { type UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";

export interface SeedUserSettingsInput {
  readonly userId: string;
  readonly consent: ConsentSeedInput;
}

interface SeedUserSettingsDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "create">;
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "create">;
}

export class SeedUserSettings {
  readonly #dependencies: SeedUserSettingsDependencies;

  constructor(dependencies: SeedUserSettingsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SeedUserSettingsInput): Promise<void> {
    // Auth 프로비저닝이 연 CLS transaction에 참여한다.
    await this.#dependencies.consentRepository.create(input.userId, input.consent);
    await this.#dependencies.preferenceRepository.create(input.userId, {
      pushEnabled: true,
      nightPushEnabled: true,
    });
  }
}
