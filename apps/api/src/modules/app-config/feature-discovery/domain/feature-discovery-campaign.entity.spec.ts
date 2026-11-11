import { createFeatureDiscoveryCampaignFixture } from "#test/fixtures/app-config/feature-discovery-campaign.fixture";

describe("FeatureDiscoveryCampaign — 기능 소개 캠페인", () => {
  it("최소 앱 버전 이상이고 SemVer인 앱에만 소개를 보인다", () => {
    // Given
    const campaign = createFeatureDiscoveryCampaignFixture({ minAppVersion: "1.8.0" });

    // Then
    expect(campaign.isAvailableTo("1.8.0")).toBe(true);
    expect(campaign.isAvailableTo("1.15.0")).toBe(true);
    expect(campaign.isAvailableTo("1.7.9")).toBe(false);
    expect(campaign.isAvailableTo("1.8")).toBe(false);
    expect(campaign.isAvailableTo(null)).toBe(false);
  });
});
