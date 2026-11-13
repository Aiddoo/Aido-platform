import { Inject, Injectable } from "@nestjs/common";

import {
  type AppConfigAppVersionsConfig,
  appConfigAppVersionsConfig,
} from "../../app-config-app-versions.config.js";
import { AppReleaseRepositoryPort } from "../../application/ports/app-release.repository.port.js";
import type { AppRelease } from "../../domain/app-release.aggregate.js";
import { toAppReleases } from "./app-release-env.mapper.js";

@Injectable()
export class EnvironmentAppReleaseRepository extends AppReleaseRepositoryPort {
  readonly #config: AppConfigAppVersionsConfig;

  constructor(@Inject(appConfigAppVersionsConfig.KEY) config: AppConfigAppVersionsConfig) {
    super();
    this.#config = config;
  }

  listLatestReleases(): AppRelease[] {
    return toAppReleases(this.#config);
  }
}
