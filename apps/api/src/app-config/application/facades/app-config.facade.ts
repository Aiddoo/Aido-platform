import { Injectable } from "@nestjs/common";
import type { FeatureDiscoveryConfig } from "../ports/feature-discovery-config.port";
import { GetFeatureDiscoveryUseCase } from "../queries/get-feature-discovery/get-feature-discovery.use-case";

@Injectable()
export class AppConfigFacade {
	constructor(
		private readonly getFeatureDiscoveryUseCase: GetFeatureDiscoveryUseCase,
	) {}

	getFeatureDiscovery(): FeatureDiscoveryConfig {
		return this.getFeatureDiscoveryUseCase.execute();
	}
}
