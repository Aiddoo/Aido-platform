import { Test } from "@nestjs/testing";

import { GetAppVersionUseCase } from "../application/queries/get-app-version/get-app-version.use-case.js";
import { GetFeatureDiscoveryUseCase } from "../application/queries/get-feature-discovery/get-feature-discovery.use-case.js";
import { AppConfigController } from "./app-config.controller.js";

describe("AppConfigController — feature discovery endpoint", () => {
  it("returns the public campaign configuration from the use case", async () => {
    // Given
    const module = await Test.createTestingModule({
      controllers: [AppConfigController],
      providers: [
        { provide: GetAppVersionUseCase, useValue: { execute: () => ({ enabled: false }) } },
        {
          provide: GetFeatureDiscoveryUseCase,
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

  it("returns the published app version configuration", async () => {
    const module = await Test.createTestingModule({
      controllers: [AppConfigController],
      providers: [
        { provide: GetFeatureDiscoveryUseCase, useValue: { execute: () => ({ enabled: false }) } },
        {
          provide: GetAppVersionUseCase,
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
