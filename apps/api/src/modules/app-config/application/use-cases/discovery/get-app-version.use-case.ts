import type { AppVersionResponse } from "@aido/api";

import { type AppVersionConfigPort } from "../../ports/discovery/app-version-config.port.js";

interface GetAppVersionDependencies {
  readonly config: AppVersionConfigPort;
}

export class GetAppVersion {
  readonly #dependencies: GetAppVersionDependencies;

  constructor(dependencies: GetAppVersionDependencies) {
    this.#dependencies = dependencies;
  }

  execute(): AppVersionResponse {
    return this.#dependencies.config.getAppVersion();
  }
}
