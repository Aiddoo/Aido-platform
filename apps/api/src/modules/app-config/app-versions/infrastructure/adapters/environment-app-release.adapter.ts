import { Inject, Injectable } from "@nestjs/common";

import {
  type AppConfigAppVersionsConfig,
  appConfigAppVersionsConfig,
} from "../../app-config-app-versions.config.js";
import { AppReleaseReaderPort } from "../../application/ports/app-release.reader.port.js";
import { AppRelease } from "../../domain/app-release.entity.js";

@Injectable()
export class EnvironmentAppReleaseAdapter extends AppReleaseReaderPort {
  readonly #config: AppConfigAppVersionsConfig;

  constructor(@Inject(appConfigAppVersionsConfig.KEY) config: AppConfigAppVersionsConfig) {
    super();
    this.#config = config;
  }

  listLatestReleases(): AppRelease[] {
    const { enabled, iosLatestVersion, androidLatestVersion } = this.#config;
    if (!enabled || !iosLatestVersion || !androidLatestVersion) {
      return [];
    }
    return [
      AppRelease.reconstitute({ platform: "ios", latestVersion: iosLatestVersion }),
      AppRelease.reconstitute({ platform: "android", latestVersion: androidLatestVersion }),
    ];
  }
}
