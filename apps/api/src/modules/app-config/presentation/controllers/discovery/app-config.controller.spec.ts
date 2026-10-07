import { Test } from "@nestjs/testing";

import { GetAppVersion } from "../../../application/use-cases/discovery/get-app-version.use-case.js";
import { GetFeatureDiscovery } from "../../../application/use-cases/discovery/get-feature-discovery.use-case.js";
import { AppConfigController } from "./app-config.controller.js";

describe("AppConfigController — 공개 앱 설정 조회", () => {
  it("UseCase가 조회한 공개 캠페인 설정을 반환한다", async () => {
    // Given
    const module = await Test.createTestingModule({
      controllers: [AppConfigController],
      providers: [
        { provide: GetAppVersion, useValue: { execute: () => ({ enabled: false }) } },
        {
          provide: GetFeatureDiscovery,
          useValue: {
            execute: () => ({ enabled: false }),
          },
        },
      ],
    }).compile();
    const controller = module.get(AppConfigController);

    // When
    const result = controller.getFeatureDiscovery();

    // Then
    expect(result).toEqual({ enabled: false });
    await module.close();
  });

  it("배포된 앱 버전 설정을 반환한다", async () => {
    const module = await Test.createTestingModule({
      controllers: [AppConfigController],
      providers: [
        { provide: GetFeatureDiscovery, useValue: { execute: () => ({ enabled: false }) } },
        {
          provide: GetAppVersion,
          useValue: {
            execute: () => ({
              enabled: true,
              ios: { latestVersion: "1.9.1" },
              android: { latestVersion: "1.9.1" },
            }),
          },
        },
      ],
    }).compile();
    expect(module.get(AppConfigController).getAppVersion()).toEqual({
      enabled: true,
      ios: { latestVersion: "1.9.1" },
      android: { latestVersion: "1.9.1" },
    });
    await module.close();
  });
});
