import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { MemoId } from "../domain/memo-id.vo.js";

// 문자열은 voice가 쓰는 공용 메모 잠금 키와 같아야 voice 계획 저장·배포 중 옛 버전과 같은 잠금을 잡는다
export const MemoLockKeys = {
  memo: (memoId: MemoId) => `${MUTATION_KEY_PREFIX}:memo:${memoId.value}`,
  sortOrder: (userId: UserId) => `${MUTATION_KEY_PREFIX}:memo-sort-order:${userId.value}`,
} as const;
