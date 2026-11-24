import { z } from 'zod';

/** 카테고리 하나의 할 일 한도. 서버는 끝내지 않은 할 일과 진행 중인 반복만 세고 완료한 할 일은 세지 않는다 */
const todoResourceLimitSchema = z.object({
  maxPerCategory: z.int().nonnegative(),
  activeCount: z.int().nonnegative(),
});
export type TodoResourceLimit = z.infer<typeof todoResourceLimitSchema>;

/** 카테고리에 더 넣을 수 있는 할 일 수. 이미 한도를 넘었으면 0이다 */
function calculateRoomLeft(limit: TodoResourceLimit) {
  return Math.max(0, limit.maxPerCategory - limit.activeCount);
}

export const TodoResourceLimitPolicy = {
  calculateRoomLeft,
} as const;
