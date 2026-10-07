import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import {
  createUserConsentRepositoryMock,
  createUserPreferenceRepositoryMock,
} from "#test/mocks/ports/user-settings.mock";

import {
  type ConsentSeedInput,
  type UserConsentRepositoryPort,
} from "../../ports/settings/user-consent.repository.port.js";
import { type UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";
import { SeedUserSettings } from "./seed-user-settings.use-case.js";

const userId = "user-1";

const consent: ConsentSeedInput = {
  termsAgreedAt: new Date("2024-01-01T00:00:00.000Z"),
  privacyAgreedAt: new Date("2024-01-01T00:00:00.000Z"),
  agreedTermsVersion: "1.0",
  marketingAgreedAt: null,
  marketingPushAgreedAt: null,
};

describe("SeedUserSettings", () => {
  let useCase: SeedUserSettings;
  let consentRepo: Mocked<UserConsentRepositoryPort>;
  let preferenceRepo: Mocked<UserPreferenceRepositoryPort>;

  beforeEach(async () => {
    const seedUserSettingsDependencies = mockDeep<
      ConstructorParameters<typeof SeedUserSettings>[0]
    >({
      consentRepository: createUserConsentRepositoryMock(),
      preferenceRepository: createUserPreferenceRepositoryMock(),
    });
    const unit = new SeedUserSettings(seedUserSettingsDependencies);
    useCase = unit;
    consentRepo = seedUserSettingsDependencies.consentRepository;
    preferenceRepo = seedUserSettingsDependencies.preferenceRepository;
  });

  it("동의 레코드와 푸시 설정 기본 행을 함께 생성한다", async () => {
    // Given: 두 리포지토리 create 성공
    consentRepo.create.mockResolvedValue({
      termsAgreedAt: consent.termsAgreedAt ?? null,
      privacyAgreedAt: consent.privacyAgreedAt ?? null,
      agreedTermsVersion: consent.agreedTermsVersion ?? null,
      marketingAgreedAt: null,
      marketingPushAgreedAt: null,
    });

    // When: 시딩 실행
    await useCase.execute(userId, consent);

    // Then: 동의는 전달된 입력으로, 설정은 푸시 기본값(true/true)으로 생성
    expect(consentRepo.create).toHaveBeenCalledWith(userId, consent);
    expect(preferenceRepo.create).toHaveBeenCalledWith(userId, {
      pushEnabled: true,
      nightPushEnabled: true,
    });
  });

  it("설정 기본값은 항상 고정 푸시 플래그를 사용한다(입력 무관)", async () => {
    // Given: create 성공
    consentRepo.create.mockResolvedValue({
      termsAgreedAt: null,
      privacyAgreedAt: null,
      agreedTermsVersion: null,
      marketingAgreedAt: null,
      marketingPushAgreedAt: null,
    });

    // When: 빈 동의 입력으로 시딩
    await useCase.execute(userId, {});

    // Then: 설정 행은 동의 입력과 무관하게 항상 pushEnabled/nightPushEnabled true
    expect(preferenceRepo.create).toHaveBeenCalledWith(userId, {
      pushEnabled: true,
      nightPushEnabled: true,
    });
  });
});
