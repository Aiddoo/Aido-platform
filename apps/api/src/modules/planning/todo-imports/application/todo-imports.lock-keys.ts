import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export const TodoImportLockKeys = {
  // 한 사용자의 가져오기 시작·업로드·확정·잡 묶음을 한 줄로 세운다. 카테고리·정렬 잠금보다 먼저 따로 잡는다
  userImports: (userId: UserId): string => `${MUTATION_KEY_PREFIX}:todo-import:${userId.value}`,
} as const;
