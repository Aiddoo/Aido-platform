import type { AppConfigFeatureDiscoveryConfig } from "../../app-config-feature-discovery.config.js";
import { toFeatureDiscoveryCampaign } from "./feature-discovery-campaign-env.mapper.js";

function createConfig(
  overrides: Partial<AppConfigFeatureDiscoveryConfig> = {},
): AppConfigFeatureDiscoveryConfig {
  return {
    enabled: true,
    campaignId: "feature-discovery-2026-08",
    minAppVersion: "1.8.0",
    launchedAt: "2026-08-01T00:00:00.000Z",
    autoOpen: true,
    ...overrides,
  };
}

describe("toFeatureDiscoveryCampaign — 환경 설정에 따른 기능 비활성화", () => {
  it("활성 설정에 필수 정보가 누락되면 캠페인이 없다", () => {
    // Given - 시작 검증을 우회한 잘못된 설정
    const config = createConfig({ campaignId: undefined });

    // Then
    expect(toFeatureDiscoveryCampaign(config)).toBeNull();
  });

  it("출시 시각을 읽을 수 없으면 캠페인이 없다", () => {
    // Given
    const config = createConfig({ launchedAt: "not-a-date" });

    // Then
    expect(toFeatureDiscoveryCampaign(config)).toBeNull();
  });

  it("사용자 정보와 안내 문구 없이 설정된 캠페인 메타데이터만 돌려준다", () => {
    // Given
    const config = createConfig();

    // When
    const campaign = toFeatureDiscoveryCampaign(config);

    // Then
    expect(campaign?.toPrimitives()).toEqual({
      campaignId: "feature-discovery-2026-08",
      minAppVersion: "1.8.0",
      launchedAt: Temporal.Instant.from("2026-08-01T00:00:00.000Z"),
      autoOpen: true,
    });
  });
});
