import request from "supertest";
import { vi } from "vitest";

import { AppReleaseReaderPort } from "#api/modules/app-config/app-versions/application/ports/app-release.reader.port";
import { FeatureDiscoveryCampaignReaderPort } from "#api/modules/app-config/feature-discovery/application/ports/feature-discovery-campaign.reader.port";

import {
  releasedAppVersionResponseSchema,
  releasedFeatureDiscoveryResponseSchema,
} from "./fixtures/released-app-config-response.schema.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const enabledEnvironment = {
  APP_VERSION_CHECK_ENABLED: "true",
  APP_VERSION_CHECK_IOS_LATEST_VERSION: "1.15.1",
  APP_VERSION_CHECK_ANDROID_LATEST_VERSION: "1.15.0",
  FEATURE_DISCOVERY_ENABLED: "true",
  FEATURE_DISCOVERY_CAMPAIGN_ID: "feature-discovery-2026-12",
  FEATURE_DISCOVERY_MIN_APP_VERSION: "1.15.0",
  FEATURE_DISCOVERY_LAUNCHED_AT: "2026-11-10T00:00:00.000Z",
};

describe("출시 앱이 strict로 읽는 app-config 응답 (E2E)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp({ env: enabledEnvironment });
  });

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  function server() {
    return request(ctx.app.getHttpServer());
  }

  it("켜진 앱 버전 응답을 1.10.0 이후 출시 앱이 플랫폼별 값 그대로 읽는다", async () => {
    // When
    const response = await server().get("/v1/app-config/app-version").expect(200);

    // Then
    expect(releasedAppVersionResponseSchema.safeParse(response.body)).toEqual({
      success: true,
      data: {
        enabled: true,
        ios: { latestVersion: "1.15.1" },
        android: { latestVersion: "1.15.0" },
      },
    });
  });

  it("꺼진 앱 버전 응답도 1.10.0 이후 출시 앱이 읽는다", async () => {
    // Given
    vi.spyOn(ctx.module.get(AppReleaseReaderPort), "listLatestReleases").mockReturnValueOnce([]);

    // When
    const response = await server().get("/v1/app-config/app-version").expect(200);

    // Then
    expect(releasedAppVersionResponseSchema.safeParse(response.body)).toEqual({
      success: true,
      data: { enabled: false },
    });
  });

  it("켜진 기능 발견 응답을 1.8.0 이후 출시 앱이 읽는다", async () => {
    // When
    const response = await server().get("/v1/app-config/feature-discovery").expect(200);

    // Then
    expect(releasedFeatureDiscoveryResponseSchema.safeParse(response.body)).toEqual({
      success: true,
      data: {
        enabled: true,
        campaignId: "feature-discovery-2026-12",
        minAppVersion: "1.15.0",
        launchedAt: "2026-11-10T00:00:00.000Z",
        autoOpen: true,
      },
    });
  });

  it("꺼진 기능 발견 응답도 1.8.0 이후 출시 앱이 읽는다", async () => {
    // Given
    vi.spyOn(
      ctx.module.get(FeatureDiscoveryCampaignReaderPort),
      "findActiveCampaign",
    ).mockReturnValueOnce(null);

    // When
    const response = await server().get("/v1/app-config/feature-discovery").expect(200);

    // Then
    expect(releasedFeatureDiscoveryResponseSchema.safeParse(response.body)).toEqual({
      success: true,
      data: { enabled: false },
    });
  });
});
