import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";

import type { NotificationMilestone } from "../domain/notification-milestone.constants.js";

// 문자열을 바꾸면 배포가 겹치는 동안 이전 버전과 다른 잠금을 잡으므로 바이트 단위로 유지한다
export const PushLockKeys = {
  recentNotification: (dedupKey: string): string =>
    `${MUTATION_KEY_PREFIX}:notification:${dedupKey}`,
  milestone: (userId: string, milestone: NotificationMilestone): string =>
    `${MUTATION_KEY_PREFIX}:notification:milestone:${userId}:${milestone}`,
} as const;
