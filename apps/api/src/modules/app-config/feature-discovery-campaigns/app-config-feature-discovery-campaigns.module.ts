import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { appConfigFeatureDiscoveryCampaignsConfig } from "./app-config-feature-discovery-campaigns.config.js";
import { APP_CONFIG_FEATURE_DISCOVERY_CAMPAIGNS_PROVIDERS } from "./app-config-feature-discovery-campaigns.providers.js";
import { FeatureDiscoveryController } from "./presentation/http/v1/feature-discovery.controller.js";

@Module({
  imports: [ConfigModule.forFeature(appConfigFeatureDiscoveryCampaignsConfig)],
  controllers: [FeatureDiscoveryController],
  providers: [...APP_CONFIG_FEATURE_DISCOVERY_CAMPAIGNS_PROVIDERS],
})
export class AppConfigFeatureDiscoveryCampaignsModule {}
