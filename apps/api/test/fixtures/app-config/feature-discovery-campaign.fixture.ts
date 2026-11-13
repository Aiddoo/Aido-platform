import {
  FeatureDiscoveryCampaign,
  type FeatureDiscoveryCampaignPrimitives,
} from "#api/modules/app-config/feature-discovery/domain/feature-discovery-campaign.aggregate";

export function createFeatureDiscoveryCampaignFixture(
  overrides: Partial<FeatureDiscoveryCampaignPrimitives> = {},
): FeatureDiscoveryCampaign {
  return FeatureDiscoveryCampaign.reconstitute({
    campaignId: "feature-discovery-2026-08",
    minAppVersion: "1.8.0",
    launchedAt: Temporal.Instant.from("2026-08-01T00:00:00Z"),
    autoOpen: true,
    ...overrides,
  });
}
