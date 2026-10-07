import { type FactoryProvider } from "@nestjs/common";

import { APP_VERSION_CONFIG } from "./application/ports/discovery/app-version-config.port.js";
import { FEATURE_DISCOVERY_CONFIG } from "./application/ports/discovery/feature-discovery-config.port.js";
import { GetAppVersion } from "./application/use-cases/discovery/get-app-version.use-case.js";
import { GetFeatureDiscovery } from "./application/use-cases/discovery/get-feature-discovery.use-case.js";

export const getAppVersionProvider: FactoryProvider<GetAppVersion> = {
  provide: GetAppVersion,
  inject: [APP_VERSION_CONFIG],
  useFactory: (config: ConstructorParameters<typeof GetAppVersion>[0]["config"]) =>
    new GetAppVersion({ config }),
};

export const getFeatureDiscoveryProvider: FactoryProvider<GetFeatureDiscovery> = {
  provide: GetFeatureDiscovery,
  inject: [FEATURE_DISCOVERY_CONFIG],
  useFactory: (config: ConstructorParameters<typeof GetFeatureDiscovery>[0]["config"]) =>
    new GetFeatureDiscovery({ config }),
};
