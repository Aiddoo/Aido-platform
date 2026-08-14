import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import type {
	FeatureDiscoveryConfig,
	FeatureDiscoveryConfigPort,
} from "../../application/ports/feature-discovery-config.port";

/**
 * Environment-backed rollout config. It fails closed even if a future config
 * loader bypasses startup validation.
 */
@Injectable()
export class FeatureDiscoveryConfigAdapter implements FeatureDiscoveryConfigPort {
	constructor(private readonly config: TypedConfigService) {}

	getFeatureDiscovery(): FeatureDiscoveryConfig {
		const featureDiscovery = this.config.featureDiscovery;
		if (
			!featureDiscovery.enabled ||
			!featureDiscovery.campaignId ||
			!featureDiscovery.minAppVersion ||
			!featureDiscovery.launchedAt
		) {
			return { enabled: false };
		}

		return {
			enabled: true,
			campaignId: featureDiscovery.campaignId,
			minAppVersion: featureDiscovery.minAppVersion,
			launchedAt: featureDiscovery.launchedAt,
			autoOpen: featureDiscovery.autoOpen,
		};
	}
}
