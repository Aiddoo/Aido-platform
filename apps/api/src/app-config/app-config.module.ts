import { Module } from "@nestjs/common";

import { FEATURE_DISCOVERY_CONFIG } from "./application/ports/feature-discovery-config.port";
import { AppConfigQueryUseCases } from "./application/queries";
import { FeatureDiscoveryConfigAdapter } from "./infrastructure/adapters/feature-discovery-config.adapter";
import { AppConfigController } from "./presentation/app-config.controller";

@Module({
	controllers: [AppConfigController],
	providers: [
		...AppConfigQueryUseCases,
		FeatureDiscoveryConfigAdapter,
		{
			provide: FEATURE_DISCOVERY_CONFIG,
			useExisting: FeatureDiscoveryConfigAdapter,
		},
	],
})
export class AppConfigModule {}
