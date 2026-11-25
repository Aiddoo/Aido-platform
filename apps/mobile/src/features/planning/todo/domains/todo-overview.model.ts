import { z } from 'zod';

// 기기와 무관한 서버 기록이다. 진행 중 반복은 서버가 정한다(다음 회차가 남은 규칙, 휴면 규칙 포함)
const todoOverviewSchema = z.object({
  hasTodo: z.boolean(),
  hasCompletedTodo: z.boolean(),
  hasActiveRepeat: z.boolean(),
});
export type TodoOverview = z.infer<typeof todoOverviewSchema>;

// 만들거나 끝낸 응답으로 서버 기록을 다시 받지 않고 맞춘다. 이미 맞으면 같은 값을 돌려줘 다시 그리지 않는다
export const TodoOverviewPolicy = {
  withTodoCreated(overview: TodoOverview): TodoOverview {
    return overview.hasTodo ? overview : { ...overview, hasTodo: true };
  },

  withTodoCompleted(overview: TodoOverview): TodoOverview {
    return overview.hasCompletedTodo ? overview : { ...overview, hasCompletedTodo: true };
  },
};
