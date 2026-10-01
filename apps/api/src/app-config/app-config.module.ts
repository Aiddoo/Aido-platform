import { Module } from "@nestjs/common";

import { AppConfigModule as EnvironmentConfigModule } from "#api/shared/infrastructure/config/index";

import { APP_CONFIG_PROVIDERS } from "./application/app-config.providers.js";
import { APP_VERSION_CONFIG } from "./application/ports/app-version-config.port.js";
import { FEATURE_DISCOVERY_CONFIG } from "./application/ports/feature-discovery-config.port.js";
import { AppVersionConfigAdapter } from "./infrastructure/adapters/app-version-config.adapter.js";
import { FeatureDiscoveryConfigAdapter } from "./infrastructure/adapters/feature-discovery-config.adapter.js";
import { AppConfigController } from "./presentation/app-config.controller.js";

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
export class AppConfigModule {}
