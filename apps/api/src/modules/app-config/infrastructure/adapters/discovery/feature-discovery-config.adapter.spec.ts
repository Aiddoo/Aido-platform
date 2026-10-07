import { TestBed } from "@suites/unit";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import { FeatureDiscoveryConfigAdapter } from "./feature-discovery-config.adapter.js";

describe("FeatureDiscoveryConfigAdapter — 환경 설정에 따른 기능 비활성화", () => {
  it("활성 설정에 필수 정보가 누락되면 기능을 비활성화한다", async () => {
    // Given - a malformed config source bypassing startup validation
    const { unit } = await TestBed.solitary(FeatureDiscoveryConfigAdapter)
      .mock(TypedConfigService)
      .impl(() => ({
        featureDiscovery: {
          enabled: true,
          campaignId: undefined,
          minAppVersion: "1.8.0",
          launchedAt: "2026-08-01T00:00:00.000Z",
          autoOpen: true,
        },
      }))
      .compile();

    // When
    const result = unit.getFeatureDiscovery();

    // Then
    expect(result).toEqual({ enabled: false });
  });

  it("사용자 정보와 안내 문구 없이 설정된 캠페인 메타데이터만 반환한다", async () => {
    // Given
    const { unit } = await TestBed.solitary(FeatureDiscoveryConfigAdapter)
      .mock(TypedConfigService)
      .impl(() => ({
        featureDiscovery: {
          enabled: true,
          campaignId: "feature-discovery-2026-08",
          minAppVersion: "1.8.0",
          launchedAt: "2026-08-01T00:00:00.000Z",
          autoOpen: true,
        },
      }))
      .compile();

    // When
    const result = unit.getFeatureDiscovery();

    // Then
    expect(result).toEqual({
      enabled: true,
      campaignId: "feature-discovery-2026-08",
      minAppVersion: "1.8.0",
      launchedAt: "2026-08-01T00:00:00.000Z",
      autoOpen: true,
    });
  });
});
