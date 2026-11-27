import { z } from 'zod';

/** 카테고리 하나의 할 일 한도. 서버는 끝내지 않은 할 일과 진행 중인 반복만 세고 완료한 할 일은 세지 않는다 */
const todoResourceLimitSchema = z.object({
  maxPerCategory: z.int().nonnegative(),
  // 아직 없는 새 카테고리는 서버가 세지 않아 null이다
  activeCount: z.int().nonnegative().nullable(),
});
export type TodoResourceLimit = z.infer<typeof todoResourceLimitSchema>;

export const TodoResourceLimitPolicy = {
  /** 카테고리에 더 넣을 수 있는 할 일 수. 이미 한도를 넘었으면 0이고, 새 카테고리는 비어 있어 한도만큼이다 */
  calculateRoomLeft(limit: TodoResourceLimit): number {
    if (limit.activeCount == null) {
      return limit.maxPerCategory;
    }
    return Math.max(0, limit.maxPerCategory - limit.activeCount);
  },
};
