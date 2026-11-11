import { EnvironmentFeatureDiscoveryCampaignAdapter } from "./environment-feature-discovery-campaign.adapter.js";

interface FeatureDiscoveryConfig {
  enabled: boolean;
  campaignId: string | undefined;
  minAppVersion: string | undefined;
  launchedAt: string | undefined;
  autoOpen: boolean;
}

function createAdapter(featureDiscovery: FeatureDiscoveryConfig) {
  return new EnvironmentFeatureDiscoveryCampaignAdapter(featureDiscovery);
}

describe("EnvironmentFeatureDiscoveryCampaignAdapter — 환경 설정에 따른 기능 비활성화", () => {
  it("활성 설정에 필수 정보가 누락되면 캠페인이 없다", () => {
    // Given - 시작 검증을 우회한 잘못된 설정
    const adapter = createAdapter({
      enabled: true,
      campaignId: undefined,
      minAppVersion: "1.8.0",
      launchedAt: "2026-08-01T00:00:00.000Z",
      autoOpen: true,
    });

    // Then
    expect(adapter.findActiveCampaign()).toBeNull();
  });

  it("출시 시각을 읽을 수 없으면 캠페인이 없다", () => {
    // Given
    const adapter = createAdapter({
      enabled: true,
      campaignId: "feature-discovery-2026-08",
      minAppVersion: "1.8.0",
      launchedAt: "not-a-date",
      autoOpen: true,
    });

    // Then
    expect(adapter.findActiveCampaign()).toBeNull();
  });

  it("사용자 정보와 안내 문구 없이 설정된 캠페인 메타데이터만 돌려준다", () => {
    // Given
    const adapter = createAdapter({
      enabled: true,
      campaignId: "feature-discovery-2026-08",
      minAppVersion: "1.8.0",
      launchedAt: "2026-08-01T00:00:00.000Z",
      autoOpen: true,
    });

    // When
    const campaign = adapter.findActiveCampaign();

    // Then
    expect(campaign?.toPrimitives()).toEqual({
      campaignId: "feature-discovery-2026-08",
      minAppVersion: "1.8.0",
      launchedAt: Temporal.Instant.from("2026-08-01T00:00:00.000Z"),
      autoOpen: true,
    });
  });
});
