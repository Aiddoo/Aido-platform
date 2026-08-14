import { Inject, Injectable } from "@nestjs/common";

import {
	FEATURE_DISCOVERY_CONFIG,
	type FeatureDiscoveryConfig,
	type FeatureDiscoveryConfigPort,
} from "../../ports/feature-discovery-config.port";

@Injectable()
export class GetFeatureDiscoveryUseCase {
	constructor(
		@Inject(FEATURE_DISCOVERY_CONFIG)
		private readonly config: FeatureDiscoveryConfigPort,
	) {}

	execute(): FeatureDiscoveryConfig {
		return this.config.getFeatureDiscovery();
	}
}
