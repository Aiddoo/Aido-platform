import type { FeatureDiscoveryConfig } from "../../read-models/discovery/feature-discovery.read-model.js";

export type { FeatureDiscoveryConfig } from "../../read-models/discovery/feature-discovery.read-model.js";

export const FEATURE_DISCOVERY_CONFIG = Symbol("FEATURE_DISCOVERY_CONFIG");

export interface FeatureDiscoveryConfigPort {
  getFeatureDiscovery(): FeatureDiscoveryConfig;
}
