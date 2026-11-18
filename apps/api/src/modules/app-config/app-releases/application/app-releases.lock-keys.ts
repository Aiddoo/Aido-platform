import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";

import type { AppReleaseId } from "../domain/app-release-id.vo.js";

export const AppReleaseLockKeys = {
  release: (appReleaseId: AppReleaseId): string =>
    `${MUTATION_KEY_PREFIX}:app-release:${appReleaseId.value}`,
} as const;
