import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export const SuggestionLockKeys = {
  analysisRun: (userId: UserId): string =>
    `${MUTATION_KEY_PREFIX}:suggestion-analysis-run:${userId.value}`,
} as const;
