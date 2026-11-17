import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ConsentAgreement } from "../../domain/user-consent.entity.js";
import { UserPreference } from "../../domain/user-preference.aggregate.js";
import { type UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";

export interface SeedUserSettingsCommand {
  readonly userId: string;
  readonly consent: ConsentAgreement;
}

interface SeedUserSettingsDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "save">;
}

export class SeedUserSettingsUseCase {
  readonly #dependencies: SeedUserSettingsDependencies;

  constructor(dependencies: SeedUserSettingsDependencies) {
    this.#dependencies = dependencies;
  }

  // 가입 트랜잭션 안에서 새 사용자의 설정·동의 행을 만든다. 아직 아무도 읽지 않아 잠금이 없다
  async execute(input: SeedUserSettingsCommand): Promise<void> {
    const preference = UserPreference.create({
      userId: UserId.reconstitute(input.userId),
      consent: input.consent,
    });
    await this.#dependencies.preferenceRepository.save(preference);
  }
}
