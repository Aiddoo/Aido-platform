import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";

import { AppConfigDiscoveryModule } from "#api/modules/app-config/app-config-discovery.public";
import {
  APP_VERSION_CONFIG,
  type AppVersionConfigPort,
} from "#api/modules/app-config/application/ports/discovery/app-version-config.port";
import {
  FEATURE_DISCOVERY_CONFIG,
  type FeatureDiscoveryConfigPort,
  type FeatureDiscoveryConfig,
} from "#api/modules/app-config/application/ports/discovery/feature-discovery-config.port";
import type { AppVersionConfig } from "#api/modules/app-config/application/read-models/discovery/app-version.read-model";
import { ResponseTransformInterceptor } from "#api/platform/http/interceptors/response-transform.interceptor";

class StubDiscoveryConfig implements AppVersionConfigPort, FeatureDiscoveryConfigPort {
  featureDiscovery: FeatureDiscoveryConfig = { enabled: false };
  appVersion: AppVersionConfig = { enabled: false };
  getFeatureDiscovery(): FeatureDiscoveryConfig {
    return this.featureDiscovery;
  }
  getAppVersion(): AppVersionConfig {
    return this.appVersion;
  }
  reset(): void {
    this.featureDiscovery = { enabled: false };
    this.appVersion = { enabled: false };
  }
}

const enabledCampaign: FeatureDiscoveryConfig = {
  enabled: true,
  campaignId: "synthetic-campaign",
  minAppVersion: "1.9.1",
  launchedAt: "2026-10-08T00:00:00.000Z",
  autoOpen: true,
};

describe("기능 발견 설정 route (Integration)", () => {
  let app: INestApplication<App>;
  const config = new StubDiscoveryConfig();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppConfigDiscoveryModule],
      providers: [ResponseTransformInterceptor],
    })
      .overrideProvider(FEATURE_DISCOVERY_CONFIG)
      .useValue(config)
      .overrideProvider(APP_VERSION_CONFIG)
      .useValue(config)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix("v1");
    app.useGlobalInterceptors(module.get(ResponseTransformInterceptor));
    await app.init();
  });

  beforeEach(() => {
    config.reset();
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
    config.featureDiscovery = enabledCampaign;
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
    config.featureDiscovery = enabledCampaign;
    const active = await request(app.getHttpServer())
      .get("/v1/app-config/feature-discovery")
      .expect(200);
    expect(active.body).toEqual(enabledCampaign);
    // When - 설정 Stub의 현재 값만 비활성화한다
    config.featureDiscovery = { enabled: false };
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
    config.appVersion = {
      enabled: true,
      ios: { latestVersion: "1.9.1" },
      android: { latestVersion: "1.9.2" },
    };
    const enabled = await request(app.getHttpServer())
      .get("/v1/app-config/app-version")
      .expect(200);
    // Then - 플랫폼별 버전을 그대로 반환하고 재요청 캐시를 막는다
    expect(enabled.body).toEqual(config.appVersion);
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
