import {
  getAppVersionProvider,
  getFeatureDiscoveryProvider,
} from "./app-config-discovery-application.providers.js";

export const APP_CONFIG_PROVIDERS = [getAppVersionProvider, getFeatureDiscoveryProvider] as const;
