import type { AppVersionResponse } from "@aido/api";
import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import type { AppVersionConfigPort } from "../../../application/ports/discovery/app-version-config.port.js";

@Injectable()
export class AppVersionConfigAdapter implements AppVersionConfigPort {
  constructor(private readonly config: TypedConfigService) {}

  getAppVersion(): AppVersionResponse {
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
