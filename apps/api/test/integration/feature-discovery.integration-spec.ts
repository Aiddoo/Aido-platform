import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";

import { AppConfigAppVersionsModule } from "#api/modules/app-config/app-versions/app-config-app-versions.module";
import { AppReleaseRepositoryPort } from "#api/modules/app-config/app-versions/application/ports/app-release.repository.port";
import { AppConfigFeatureDiscoveryModule } from "#api/modules/app-config/feature-discovery/app-config-feature-discovery.module";
import { FeatureDiscoveryCampaignRepositoryPort } from "#api/modules/app-config/feature-discovery/application/ports/feature-discovery-campaign.repository.port";
import { API_VERSIONING_OPTIONS } from "#api/platform/http/api-versioning";
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

describe("기능 발견 설정 route (Integration)", () => {
  let app: INestApplication<App>;
  const campaignRepository = new InMemoryFeatureDiscoveryCampaignRepository();
  const appReleaseRepository = new InMemoryAppReleaseRepository();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      // 공개 조회 route만 띄운다. 관리자 모듈은 트랜잭션·잠금 같은 전역 platform 모듈이 있어야 뜬다
      imports: [AppConfigAppVersionsModule, AppConfigFeatureDiscoveryModule],
      providers: [ResponseTransformInterceptor],
    })
      .overrideProvider(FeatureDiscoveryCampaignRepositoryPort)
      .useValue(campaignRepository)
      .overrideProvider(AppReleaseRepositoryPort)
      .useValue(appReleaseRepository)
      .compile();

    app = module.createNestApplication();
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
    const response = await request(app.getHttpServer())
      .get("/v1/app-config/feature-discovery")
      .expect(200);

    // Then - no authorization, user data, or campaign copy is involved
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body).toEqual({ enabled: false });
  });

  it("활성 캠페인은 응답 인터셉터가 있어도 래핑 없이 전체 설정을 제공한다", async () => {
    // Given - 실제 모듈에 활성 설정과 전역 응답 인터셉터가 연결되어 있다
    campaignRepository.campaign = createFeatureDiscoveryCampaignFixture({
      campaignId: enabledCampaign.campaignId,
      minAppVersion: enabledCampaign.minAppVersion,
      launchedAt: Temporal.Instant.from(enabledCampaign.launchedAt),
    });
    // When - 공개 route를 조회한다
    const response = await request(app.getHttpServer())
      .get("/v1/app-config/feature-discovery")
      .expect(200);
    // Then - campaign copy나 success envelope 없이 계약된 설정만 반환한다
    expect(response.body).toEqual(enabledCampaign);
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });

  it("운영 중 kill switch가 꺼지면 같은 앱의 다음 요청에 바로 반영된다", async () => {
    // Given - 첫 요청에서 활성 캠페인이 반환된다
    campaignRepository.campaign = createFeatureDiscoveryCampaignFixture({
      campaignId: enabledCampaign.campaignId,
      minAppVersion: enabledCampaign.minAppVersion,
      launchedAt: Temporal.Instant.from(enabledCampaign.launchedAt),
    });
    const active = await request(app.getHttpServer())
      .get("/v1/app-config/feature-discovery")
      .expect(200);
    expect(active.body).toEqual(enabledCampaign);
    // When - 설정 Stub의 현재 값만 비활성화한다
    campaignRepository.campaign = null;
    const disabled = await request(app.getHttpServer())
      .get("/v1/app-config/feature-discovery")
      .expect(200);
    // Then - 이전 캠페인 필드가 남지 않고 재요청도 캐시하지 않는다
    expect(disabled.body).toEqual({ enabled: false });
    expect(disabled.headers["cache-control"]).toBe("private, no-store");
  });

  it("앱 버전 조회는 비활성과 플랫폼별 활성 버전을 raw 응답으로 제공한다", async () => {
    // Given - 버전 공개 설정이 비활성 상태다
    const disabled = await request(app.getHttpServer())
      .get("/v1/app-config/app-version")
      .expect(200);
    expect(disabled.body).toEqual({ enabled: false });
    expect(disabled.headers["cache-control"]).toBe("private, no-store");
    // When - iOS와 Android의 배포 버전을 각각 설정한다
    appReleaseRepository.releases = [
      createAppReleaseFixture({ platform: "ios", latestVersion: "1.9.1" }),
      createAppReleaseFixture({ platform: "android", latestVersion: "1.9.2" }),
    ];
    const enabled = await request(app.getHttpServer())
      .get("/v1/app-config/app-version")
      .expect(200);
    // Then - 플랫폼별 버전을 그대로 반환하고 재요청 캐시를 막는다
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

    // Then - the endpoint contract is raw (not the ordinary success wrapper)
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
