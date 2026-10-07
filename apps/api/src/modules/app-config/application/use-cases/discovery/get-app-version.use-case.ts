import { type AppVersionConfigPort } from "../../ports/discovery/app-version-config.port.js";
import type { AppVersionConfig } from "../../read-models/discovery/app-version.read-model.js";

interface GetAppVersionDependencies {
  readonly config: AppVersionConfigPort;
}

export class GetAppVersion {
  readonly #dependencies: GetAppVersionDependencies;

  constructor(dependencies: GetAppVersionDependencies) {
    this.#dependencies = dependencies;
  }

  execute(): AppVersionConfig {
    return this.#dependencies.config.getAppVersion();
  }
}
