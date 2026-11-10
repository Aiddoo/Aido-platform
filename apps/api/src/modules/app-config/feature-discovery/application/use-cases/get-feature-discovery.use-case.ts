import {
  type FeatureDiscoveryConfig,
  type FeatureDiscoveryConfigPort,
} from "../ports/feature-discovery-config.port.js";

interface GetFeatureDiscoveryDependencies {
  readonly config: FeatureDiscoveryConfigPort;
}

export class GetFeatureDiscovery {
  readonly #dependencies: GetFeatureDiscoveryDependencies;

  constructor(dependencies: GetFeatureDiscoveryDependencies) {
    this.#dependencies = dependencies;
  }

  execute(): FeatureDiscoveryConfig {
    return this.#dependencies.config.getFeatureDiscovery();
  }
}
