import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { type UserConsentRepositoryPort } from "../../ports/settings/user-consent.repository.port.js";
import { UpdateMarketingConsent } from "./update-marketing-consent.use-case.js";

describe("UpdateMarketingConsent", () => {
  let useCase: UpdateMarketingConsent;
  let repo: Mocked<UserConsentRepositoryPort>;

  beforeEach(async () => {
    const updateMarketingConsentDependencies = mockDeep<
      ConstructorParameters<typeof UpdateMarketingConsent>[0]
    >({});
    const unit = new UpdateMarketingConsent(updateMarketingConsentDependencies);
    useCase = unit;
    repo = updateMarketingConsentDependencies.consentRepository;
  });

  it("동의 시 marketingAgreedAt 반환", async () => {
    repo.upsertMarketingConsent.mockResolvedValue({
      termsAgreedAt: null,
      privacyAgreedAt: null,
      agreedTermsVersion: null,
      marketingAgreedAt: new Date("2024-01-15T10:00:00.000Z"),
      marketingPushAgreedAt: null,
    });

    const result = await useCase.execute("user-1", true);

    expect(repo.upsertMarketingConsent).toHaveBeenCalledWith("user-1", {
      agreed: true,
    });
    expect(result.marketingAgreedAt).toBe("2024-01-15T10:00:00.000Z");
  });

  it("철회 시 null 반환", async () => {
    repo.upsertMarketingConsent.mockResolvedValue({
      termsAgreedAt: null,
      privacyAgreedAt: null,
      agreedTermsVersion: null,
      marketingAgreedAt: null,
      marketingPushAgreedAt: null,
    });

    const result = await useCase.execute("user-1", false);

    expect(result.marketingAgreedAt).toBeNull();
  });
});
