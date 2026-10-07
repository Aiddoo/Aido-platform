import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import type { FeatureDiscoveryConfigPort } from "../../../application/ports/discovery/feature-discovery-config.port.js";
import type { FeatureDiscoveryConfig } from "../../../application/read-models/discovery/feature-discovery.read-model.js";

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
