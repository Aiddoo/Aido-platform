import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { MemoId } from "../domain/memo-id.vo.js";

const memoKey = (memoId: MemoId): string => `${MUTATION_KEY_PREFIX}:memo:${memoId.value}`;
const sortOrderKey = (userId: UserId): string =>
  `${MUTATION_KEY_PREFIX}:memo-sort-order:${userId.value}`;

// 문자열은 voice가 쓰는 공용 메모 잠금 키와 같아야 voice 계획 저장·배포 중 옛 버전과 같은 잠금을 잡는다
export const MemoLockKeys = {
  memo: memoKey,
  sortOrder: sortOrderKey,
  // 저장은 메모 행(내용·고정·순서)을 통째로 쓰고 재정렬은 다른 메모 순서를 SQL로 밀어서,
  // 있는 메모를 바꾸는 요청은 모두 두 키를 함께 잡아야 서로의 변경을 덮어쓰지 않는다
  existingMemo: (memoId: MemoId, userId: UserId): readonly string[] => [
    memoKey(memoId),
    sortOrderKey(userId),
  ],
} as const;
