import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";

// 문자열은 옮기기 전 공용 잠금 키와 같아야 notes·voice·ai와 배포 중 옛 버전이 같은 잠금을 잡는다
export const TodoLockKeys = {
  todo: (todoId: number): string => `${MUTATION_KEY_PREFIX}:todo:${todoId}`,
  sortOrder: (userId: string): string => `${MUTATION_KEY_PREFIX}:todo-sort-order:${userId}`,
} as const;
