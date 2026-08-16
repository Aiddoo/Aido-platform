import { Module } from "@nestjs/common";

import { APP_CONFIG_PROVIDERS } from "./application/app-config.providers";
import { FEATURE_DISCOVERY_CONFIG } from "./application/ports/feature-discovery-config.port";
import { FeatureDiscoveryConfigAdapter } from "./infrastructure/adapters/feature-discovery-config.adapter";
import { AppConfigController } from "./presentation/app-config.controller";

@Module({
	controllers: [AppConfigController],
	providers: [
		...APP_CONFIG_PROVIDERS,
		FeatureDiscoveryConfigAdapter,
		{
			provide: FEATURE_DISCOVERY_CONFIG,
			useExisting: FeatureDiscoveryConfigAdapter,
		},
	],
})
export class AppConfigModule {}
