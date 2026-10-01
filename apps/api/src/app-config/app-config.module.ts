import { Module } from "@nestjs/common";

import { APP_CONFIG_PROVIDERS } from "./application/app-config.providers";
import { APP_VERSION_CONFIG } from "./application/ports/app-version-config.port";
import { FEATURE_DISCOVERY_CONFIG } from "./application/ports/feature-discovery-config.port";
import { AppVersionConfigAdapter } from "./infrastructure/adapters/app-version-config.adapter";
import { FeatureDiscoveryConfigAdapter } from "./infrastructure/adapters/feature-discovery-config.adapter";
import { AppConfigController } from "./presentation/app-config.controller";

@Module({
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
export class AppConfigModule {}
