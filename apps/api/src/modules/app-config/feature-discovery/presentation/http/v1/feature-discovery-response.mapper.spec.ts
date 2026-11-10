import { featureDiscoveryResponseSchema } from "@aido/api/contracts/app-config";

import { createFeatureDiscoveryCampaignFixture } from "#test/fixtures/app-config/feature-discovery-campaign.fixture";

import { toFeatureDiscoveryResponse } from "./feature-discovery-response.mapper.js";

describe("toFeatureDiscoveryResponse — 기능 발견 응답", () => {
  it("캠페인이 없으면 비활성만 보낸다", () => {
    expect(toFeatureDiscoveryResponse(null)).toEqual({ enabled: false });
  });

  it("출시 시각을 ms 3자리 UTC로 보내고 공유 계약을 만족한다", () => {
    // Given
    const campaign = createFeatureDiscoveryCampaignFixture({
      launchedAt: Temporal.Instant.from("2026-08-01T00:00:00Z"),
    });

    // When
    const response = toFeatureDiscoveryResponse(campaign);

    // Then
    expect(response).toEqual({
      enabled: true,
      campaignId: "feature-discovery-2026-08",
      minAppVersion: "1.8.0",
      launchedAt: "2026-08-01T00:00:00.000Z",
      autoOpen: true,
    });
    expect(featureDiscoveryResponseSchema.safeParse(response).success).toBe(true);
  });
});
