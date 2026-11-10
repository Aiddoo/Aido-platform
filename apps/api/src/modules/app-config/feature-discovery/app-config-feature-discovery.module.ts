import { Module } from "@nestjs/common";

import { AppConfigModule as EnvironmentConfigModule } from "#api/platform/config/index";

import { APP_CONFIG_FEATURE_DISCOVERY_PROVIDERS } from "./app-config-feature-discovery.providers.js";
import { FeatureDiscoveryController } from "./presentation/http/v1/feature-discovery.controller.js";

@Module({
  imports: [EnvironmentConfigModule],
  controllers: [FeatureDiscoveryController],
  providers: [...APP_CONFIG_FEATURE_DISCOVERY_PROVIDERS],
})
export class AppConfigFeatureDiscoveryModule {}
