import { APP_PLATFORMS, type AppPlatform } from "@aido/api/vocabulary";

import type { AppConfigAppVersionsConfig } from "../../app-config-app-versions.config.js";
import { AppRelease } from "../../domain/app-release.aggregate.js";

// env에는 반영 시각이 없다. env에서 온 릴리스는 공개 조회로만 나가고 그 응답은 시각을 싣지 않는다
const ENVIRONMENT_RELEASE_UPDATED_AT = Temporal.Instant.fromEpochMilliseconds(0);

function toEnvironmentAppReleases(config: AppConfigAppVersionsConfig): AppRelease[] {
  if (!config.enabled) {
    return [];
  }
  const versionByPlatform: Record<AppPlatform, string | undefined> = {
    ios: config.iosLatestVersion,
    android: config.androidLatestVersion,
  };
  return APP_PLATFORMS.flatMap((platform) => {
    const latestVersion = versionByPlatform[platform];
    if (!latestVersion) {
      return [];
    }
    return [
      AppRelease.reconstitute({
        platform,
        latestVersion,
        updatedAt: ENVIRONMENT_RELEASE_UPDATED_AT,
      }),
    ];
  });
}

// 전환기: DB에 행이 없는 플랫폼만 env 값으로 채운다. 운영 DB에 두 플랫폼 행이 생기면 env 키와 함께 지운다(compatibility.md)
export function withEnvironmentFallback(
  storedReleases: readonly AppRelease[],
  config: AppConfigAppVersionsConfig,
): AppRelease[] {
  const storedPlatforms = new Set(storedReleases.map((release) => release.platform));
  return [
    ...storedReleases,
    ...toEnvironmentAppReleases(config).filter((release) => !storedPlatforms.has(release.platform)),
  ];
}
