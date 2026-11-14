import type { PublishAppReleaseResponse } from "@aido/api/contracts/app-config";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { AppRelease } from "../../../domain/app-release.aggregate.js";

export function toPublishAppReleaseResponse(release: AppRelease): PublishAppReleaseResponse {
  const { platform, latestVersion, updatedAt } = release.toPrimitives();
  return { appRelease: { platform, latestVersion, updatedAt: toIsoString(updatedAt) } };
}
