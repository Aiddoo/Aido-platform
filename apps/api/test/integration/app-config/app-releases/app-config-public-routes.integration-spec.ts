import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";

import { AppConfigAppReleasesModule } from "#api/modules/app-config/app-releases/app-config-app-releases.module";
import { AppReleaseRepositoryPort } from "#api/modules/app-config/app-releases/application/ports/app-release.repository.port";
import { AppConfigFeatureDiscoveryCampaignsModule } from "#api/modules/app-config/feature-discovery-campaigns/app-config-feature-discovery-campaigns.module";
import { FeatureDiscoveryCampaignRepositoryPort } from "#api/modules/app-config/feature-discovery-campaigns/application/ports/feature-discovery-campaign.repository.port";
import { API_VERSIONING_OPTIONS } from "#api/platform/http/api-versioning";
import { createHttpAdapter } from "#api/platform/http/http-adapter";
import { ResponseTransformInterceptor } from "#api/platform/http/interceptors/response-transform.interceptor";
import { InMemoryAppReleaseRepository } from "#test/doubles/app-config/in-memory-app-release.repository";
import { InMemoryFeatureDiscoveryCampaignRepository } from "#test/doubles/app-config/in-memory-feature-discovery-campaign.repository";
import { createAppReleaseFixture } from "#test/fixtures/app-config/app-release.fixture";
import { createFeatureDiscoveryCampaignFixture } from "#test/fixtures/app-config/feature-discovery-campaign.fixture";

const enabledCampaign = {
  enabled: true,
  campaignId: "synthetic-campaign",
  minAppVersion: "1.9.1",
  launchedAt: "2026-10-08T00:00:00.000Z",
  autoOpen: true,
};

describe("app-config 공개 조회 route (Integration)", () => {
  let app: INestApplication<App>;
  const campaignRepository = new InMemoryFeatureDiscoveryCampaignRepository();
  const appReleaseRepository = new InMemoryAppReleaseRepository();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      // 공개 조회 route만 띄운다. 관리자 모듈은 트랜잭션·잠금 같은 전역 platform 모듈이 있어야 뜬다
      imports: [AppConfigAppReleasesModule, AppConfigFeatureDiscoveryCampaignsModule],
      providers: [ResponseTransformInterceptor],
    })
      .overrideProvider(FeatureDiscoveryCampaignRepositoryPort)
      .useValue(campaignRepository)
      .overrideProvider(AppReleaseRepositoryPort)
      .useValue(appReleaseRepository)
      .compile();

    app = module.createNestApplication(createHttpAdapter());
    app.enableVersioning(API_VERSIONING_OPTIONS);
    app.useGlobalInterceptors(module.get(ResponseTransformInterceptor));
    await app.init();
  });

  beforeEach(() => {
    campaignRepository.campaign = null;
    appReleaseRepository.releases = [];
  });

  afterAll(async () => {
    await app?.close();
  });

  it("캐시할 수 없는 비활성 응답을 제공한다", async () => {
    // When
    const response = await request(app.getHttpServer()).get("/v1/app-config/feature-discovery");

    // Then
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body).toEqual({ enabled: false });
  });

  it("활성 캠페인은 응답 인터셉터가 있어도 래핑 없이 전체 설정을 제공한다", async () => {
    // Given
    campaignRepository.campaign = createFeatureDiscoveryCampaignFixture({
      id: enabledCampaign.campaignId,
      minAppVersion: enabledCampaign.minAppVersion,
      launchedAt: Temporal.Instant.from(enabledCampaign.launchedAt),
    });

    // When
    const response = await request(app.getHttpServer()).get("/v1/app-config/feature-discovery");

    // Then
    expect(response.status).toBe(200);
    expect(response.body).toEqual(enabledCampaign);
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });

  it("운영 중 kill switch가 꺼지면 같은 앱의 다음 요청에 바로 반영된다", async () => {
    // Given
    campaignRepository.campaign = createFeatureDiscoveryCampaignFixture({
      id: enabledCampaign.campaignId,
      minAppVersion: enabledCampaign.minAppVersion,
      launchedAt: Temporal.Instant.from(enabledCampaign.launchedAt),
    });
    const active = await request(app.getHttpServer())
      .get("/v1/app-config/feature-discovery")
      .expect(200);
    expect(active.body).toEqual(enabledCampaign);

    // When
    campaignRepository.campaign = null;
    const disabled = await request(app.getHttpServer()).get("/v1/app-config/feature-discovery");

    // Then
    expect(disabled.status).toBe(200);
    expect(disabled.body).toEqual({ enabled: false });
    expect(disabled.headers["cache-control"]).toBe("private, no-store");
  });

  it("앱 버전 조회는 비활성과 플랫폼별 활성 버전을 raw 응답으로 제공한다", async () => {
    // Given
    const disabled = await request(app.getHttpServer())
      .get("/v1/app-config/app-version")
      .expect(200);
    expect(disabled.body).toEqual({ enabled: false });
    expect(disabled.headers["cache-control"]).toBe("private, no-store");

    // When
    appReleaseRepository.releases = [
      createAppReleaseFixture({ platform: "ios", latestVersion: "1.9.1" }),
      createAppReleaseFixture({ platform: "android", latestVersion: "1.9.2" }),
    ];
    const enabled = await request(app.getHttpServer()).get("/v1/app-config/app-version");

    // Then
    expect(enabled.status).toBe(200);
    expect(enabled.body).toEqual({
      enabled: true,
      ios: { latestVersion: "1.9.1" },
      android: { latestVersion: "1.9.2" },
    });
    expect(enabled.headers["cache-control"]).toBe("private, no-store");
  });

  it("raw discriminated union과 캐시 응답 header를 문서화한다", () => {
    // When
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("Aido API").build(),
    );
    const response = document.paths["/v1/app-config/feature-discovery"]?.get?.responses?.["200"];

    // Then
    expect(response).toMatchObject({
      headers: {
        "Cache-Control": {
          schema: { type: "string" },
        },
      },
      content: {
        "application/json": {
          schema: {
            oneOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["enabled"],
                properties: { enabled: { enum: [false] } },
              },
              {
                type: "object",
                additionalProperties: false,
                required: ["enabled", "campaignId", "minAppVersion", "launchedAt", "autoOpen"],
                properties: {
                  enabled: { enum: [true] },
                  minAppVersion: { pattern: expect.any(String) },
                  launchedAt: {
                    format: "date-time",
                    pattern: expect.any(String),
                  },
                },
              },
            ],
            discriminator: { propertyName: "enabled" },
          },
        },
      },
    });
  });
});
