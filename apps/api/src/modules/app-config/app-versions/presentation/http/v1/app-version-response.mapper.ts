import type { AppVersionResponse } from "@aido/api/contracts/app-config";

import type { AppRelease } from "../../../domain/app-release.entity.js";

export function toAppVersionResponse(releases: readonly AppRelease[]): AppVersionResponse {
  const ios = releases.find((release) => release.platform === "ios");
  const android = releases.find((release) => release.platform === "android");
  if (ios == null || android == null) {
    return { enabled: false };
  }
  return {
    enabled: true,
    ios: { latestVersion: ios.latestVersion.value },
    android: { latestVersion: android.latestVersion.value },
  };
}
