import { Module } from "@nestjs/common";

import { AppConfigModule as EnvironmentConfigModule } from "#api/platform/config/index";

import { APP_CONFIG_PROVIDERS } from "./app-config-discovery.providers.js";
import { APP_VERSION_CONFIG } from "./application/ports/discovery/app-version-config.port.js";
import { FEATURE_DISCOVERY_CONFIG } from "./application/ports/discovery/feature-discovery-config.port.js";
import { AppVersionConfigAdapter } from "./infrastructure/adapters/discovery/app-version-config.adapter.js";
import { FeatureDiscoveryConfigAdapter } from "./infrastructure/adapters/discovery/feature-discovery-config.adapter.js";
import { AppConfigController } from "./presentation/controllers/discovery/app-config.controller.js";

@Module({
  imports: [EnvironmentConfigModule],
  controllers: [AppConfigController],
  providers: [
    ...APP_CONFIG_PROVIDERS,
    AppVersionConfigAdapter,
    { provide: APP_VERSION_CONFIG, useExisting: AppVersionConfigAdapter },
    FeatureDiscoveryConfigAdapter,
    {
      provide: FEATURE_DISCOVERY_CONFIG,
      useExisting: FeatureDiscoveryConfigAdapter,
    },
  ],
})
export class AppConfigDiscoveryModule {}
