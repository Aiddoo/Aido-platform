import type { AppPlatform } from "@aido/api/vocabulary";

import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";

export const AppReleaseLockKeys = {
  release: (platform: AppPlatform): string => `${MUTATION_KEY_PREFIX}:app-release:${platform}`,
} as const;
