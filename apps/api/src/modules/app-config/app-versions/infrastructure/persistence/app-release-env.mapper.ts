import type { AppConfigAppVersionsConfig } from "../../app-config-app-versions.config.js";
import { AppRelease } from "../../domain/app-release.aggregate.js";

export function toAppReleases(config: AppConfigAppVersionsConfig): AppRelease[] {
  const { enabled, iosLatestVersion, androidLatestVersion } = config;
  if (!enabled || !iosLatestVersion || !androidLatestVersion) {
    return [];
  }

  return [
    AppRelease.reconstitute({ platform: "ios", latestVersion: iosLatestVersion }),
    AppRelease.reconstitute({ platform: "android", latestVersion: androidLatestVersion }),
  ];
}
