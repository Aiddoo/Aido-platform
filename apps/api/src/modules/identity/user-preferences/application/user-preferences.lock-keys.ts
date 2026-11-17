import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 설정·동의를 바꾸는 요청은 모두 이 키를 잡고 읽는다. 연속 완료는 읽은 값 조건으로만 써서 잡지 않는다
export const UserPreferenceLockKeys = {
  preference: (userId: UserId): string => `${MUTATION_KEY_PREFIX}:user-preference:${userId.value}`,
} as const;
