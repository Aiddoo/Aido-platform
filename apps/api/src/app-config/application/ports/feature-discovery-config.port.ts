export const FEATURE_DISCOVERY_CONFIG = Symbol("FEATURE_DISCOVERY_CONFIG");

export type FeatureDiscoveryConfig =
	| { enabled: false }
	| {
			enabled: true;
			campaignId: string;
			minAppVersion: string;
			launchedAt: string;
			autoOpen: boolean;
	  };

export interface FeatureDiscoveryConfigPort {
	getFeatureDiscovery(): FeatureDiscoveryConfig;
}
