import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import type { AppVersionConfigPort } from "../../../application/ports/discovery/app-version-config.port.js";
import type { AppVersionConfig } from "../../../application/read-models/discovery/app-version.read-model.js";

@Injectable()
export class AppVersionConfigAdapter implements AppVersionConfigPort {
  constructor(private readonly config: TypedConfigService) {}

  getAppVersion(): AppVersionConfig {
    const value = this.config.appVersion;
    if (!value.enabled || !value.iosLatestVersion || !value.androidLatestVersion) {
      return { enabled: false };
    }
    return {
      enabled: true,
      ios: { latestVersion: value.iosLatestVersion },
      android: { latestVersion: value.androidLatestVersion },
    };
  }
}
