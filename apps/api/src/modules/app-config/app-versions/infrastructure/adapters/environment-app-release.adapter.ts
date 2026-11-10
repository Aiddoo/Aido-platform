import { Inject, Injectable } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import { AppReleaseReaderPort } from "../../application/ports/app-release.reader.port.js";
import { AppRelease } from "../../domain/app-release.entity.js";

@Injectable()
export class EnvironmentAppReleaseAdapter extends AppReleaseReaderPort {
  readonly #config: Pick<TypedConfigService, "appVersion">;

  constructor(@Inject(TypedConfigService) config: Pick<TypedConfigService, "appVersion">) {
    super();
    this.#config = config;
  }

  listLatestReleases(): AppRelease[] {
    const { enabled, iosLatestVersion, androidLatestVersion } = this.#config.appVersion;
    if (!enabled || !iosLatestVersion || !androidLatestVersion) {
      return [];
    }
    return [
      AppRelease.reconstitute({ platform: "ios", latestVersion: iosLatestVersion }),
      AppRelease.reconstitute({ platform: "android", latestVersion: androidLatestVersion }),
    ];
  }
}
