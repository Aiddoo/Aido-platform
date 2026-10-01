import { GetAppVersionUseCase } from "./queries/get-app-version/get-app-version.use-case";
import { GetFeatureDiscoveryUseCase } from "./queries/get-feature-discovery/get-feature-discovery.use-case";

export const APP_CONFIG_PROVIDERS = [GetAppVersionUseCase, GetFeatureDiscoveryUseCase] as const;
