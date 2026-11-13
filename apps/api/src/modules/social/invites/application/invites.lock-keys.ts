import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 문자열을 바꾸면 배포가 겹치는 동안 이전 버전과 다른 잠금을 잡으므로 바이트 단위로 유지한다
export const InviteLockKeys = {
  // 발급·재발급·수락이 함께 잡아 재발급과 수락이 엇갈리지 않게 한다
  invite: (inviterId: UserId): string => `${MUTATION_KEY_PREFIX}:invite:${inviterId.value}`,
} as const;
