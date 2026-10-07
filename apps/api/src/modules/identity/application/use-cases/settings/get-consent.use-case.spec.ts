import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { type UserConsentRepositoryPort } from "../../ports/settings/user-consent.repository.port.js";
import { GetConsent } from "./get-consent.use-case.js";

describe("GetConsent", () => {
  let useCase: GetConsent;
  let repo: Mocked<UserConsentRepositoryPort>;

  beforeEach(async () => {
    const getConsentDependencies = mockDeep<ConstructorParameters<typeof GetConsent>[0]>({});
    const unit = new GetConsent(getConsentDependencies);
    useCase = unit;
    repo = getConsentDependencies.consentRepository;
  });

  it("동의 기록이 없으면 전부 null", async () => {
    repo.findByUserId.mockResolvedValue(null);

    const result = await useCase.execute("user-1");

    expect(result).toEqual({
      termsAgreedAt: null,
      privacyAgreedAt: null,
      agreedTermsVersion: null,
      marketingAgreedAt: null,
      marketingPushAgreedAt: null,
    });
  });

  it("동의 기록이 있으면 ISO 문자열로 매핑", async () => {
    repo.findByUserId.mockResolvedValue({
      termsAgreedAt: new Date("2024-01-01T00:00:00.000Z"),
      privacyAgreedAt: new Date("2024-01-01T00:00:00.000Z"),
      agreedTermsVersion: "1.0",
      marketingAgreedAt: null,
      marketingPushAgreedAt: null,
    });

    const result = await useCase.execute("user-1");

    expect(result.termsAgreedAt).toBe("2024-01-01T00:00:00.000Z");
    expect(result.agreedTermsVersion).toBe("1.0");
    expect(result.marketingAgreedAt).toBeNull();
  });
});
