import {
  type ConsentSeedInput,
  type UserConsentRepositoryPort,
} from "../../ports/settings/user-consent.repository.port.js";
import { type UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";

/**
 * 회원가입 시 기본 설정 시딩 — 약관 동의 + 푸시 설정 기본값.
 * 호출측(auth 프로비저닝)이 연 CLS 트랜잭션에 참여한다.
 */
interface SeedUserSettingsDependencies {
  readonly consentRepository: UserConsentRepositoryPort;
  readonly preferenceRepository: UserPreferenceRepositoryPort;
}

export class SeedUserSettings {
  readonly #dependencies: SeedUserSettingsDependencies;

  constructor(dependencies: SeedUserSettingsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, consent: ConsentSeedInput): Promise<void> {
    await this.#dependencies.consentRepository.create(userId, consent);
    await this.#dependencies.preferenceRepository.create(userId, {
      pushEnabled: true,
      nightPushEnabled: true,
    });
  }
}
