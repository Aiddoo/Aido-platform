import { featureDiscoveryResponseSchema } from "@aido/api/contracts/app-config/v1";

describe("기능 발견 응답 계약", () => {
  it("활성 설정의 필수 정보 누락과 비활성 설정의 추가 정보 노출을 거부한다", () => {
    // When
    const enabledWithoutCampaign = featureDiscoveryResponseSchema.safeParse({ enabled: true });
    const disabledWithCampaign = featureDiscoveryResponseSchema.safeParse({
      enabled: false,
      campaignId: "feature-discovery-2026-08",
    });

    // Then
    expect(enabledWithoutCampaign.success).toBe(false);
    expect(disabledWithCampaign.success).toBe(false);
  });

  it("SemVer가 아닌 버전과 UTC가 아닌 출시 시각을 거부한다", () => {
    // When
    const nonSemanticVersion = featureDiscoveryResponseSchema.safeParse({
      enabled: true,
      campaignId: "feature-discovery-2026-08",
      minAppVersion: "1.8",
      launchedAt: "2026-08-01T00:00:00.000Z",
      autoOpen: true,
    });
    const nonUtcLaunchedAt = featureDiscoveryResponseSchema.safeParse({
      enabled: true,
      campaignId: "feature-discovery-2026-08",
      minAppVersion: "1.8.0",
      launchedAt: "2026-08-01T09:00:00.000+09:00",
      autoOpen: true,
    });

    // Then
    expect(nonSemanticVersion.success).toBe(false);
    expect(nonUtcLaunchedAt.success).toBe(false);
  });
});
