import type { PublishAppReleaseResponse } from "@aido/api/contracts/app-config/v1";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { AppRelease } from "../../../domain/app-release.aggregate.js";

export function toPublishAppReleaseResponse(appRelease: AppRelease): PublishAppReleaseResponse {
  const { platform, latestVersion, updatedAt } = appRelease.toPrimitives();
  return { appRelease: { platform, latestVersion, updatedAt: toIsoString(updatedAt) } };
}
