import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 문자열은 옮기기 전 공용 찌르기 잠금 키와 같아야 배포 중 옛 버전과 같은 잠금을 잡는다
export const NudgeLockKeys = {
  dailyQuota: (senderId: UserId): string =>
    `${MUTATION_KEY_PREFIX}:nudge:daily-quota:${senderId.value}`,
  cooldown: (senderId: UserId, todoId: number): string =>
    `${MUTATION_KEY_PREFIX}:nudge:cooldown:${senderId.value}:${todoId}`,
  remindCooldown: (senderId: UserId, receiverId: UserId): string =>
    `${MUTATION_KEY_PREFIX}:remind-nudge:cooldown:${senderId.value}:${receiverId.value}`,
} as const;
