import { Module } from "@nestjs/common";

import { AppConfigModule as EnvironmentConfigModule } from "#api/platform/config/index";

import { FEATURE_DISCOVERY_CONFIG } from "./application/ports/feature-discovery-config.port.js";
import { GetFeatureDiscovery } from "./application/use-cases/get-feature-discovery.use-case.js";
import { FeatureDiscoveryConfigAdapter } from "./infrastructure/adapters/feature-discovery-config.adapter.js";
import { FeatureDiscoveryController } from "./presentation/http/v1/feature-discovery.controller.js";

@Module({
  imports: [EnvironmentConfigModule],
  controllers: [FeatureDiscoveryController],
  providers: [
    FeatureDiscoveryConfigAdapter,
    { provide: FEATURE_DISCOVERY_CONFIG, useExisting: FeatureDiscoveryConfigAdapter },
    {
      provide: GetFeatureDiscovery,
      inject: [FEATURE_DISCOVERY_CONFIG],
      useFactory: (config: ConstructorParameters<typeof GetFeatureDiscovery>[0]["config"]) =>
        new GetFeatureDiscovery({ config }),
    },
  ],
})
export class AppConfigFeatureDiscoveryModule {}
