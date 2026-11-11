import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { appConfigFeatureDiscoveryConfig } from "./app-config-feature-discovery.config.js";
import { APP_CONFIG_FEATURE_DISCOVERY_PROVIDERS } from "./app-config-feature-discovery.providers.js";
import { FeatureDiscoveryController } from "./presentation/http/v1/feature-discovery.controller.js";

@Module({
  imports: [ConfigModule.forFeature(appConfigFeatureDiscoveryConfig)],
  controllers: [FeatureDiscoveryController],
  providers: [...APP_CONFIG_FEATURE_DISCOVERY_PROVIDERS],
})
export class AppConfigFeatureDiscoveryModule {}
