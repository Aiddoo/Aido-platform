import type { TodoRepeat } from '@src/features/planning/todo/schemas/todo-repeat.schema';
import type { UpdateTodoInput } from '@src/features/planning/todo/schemas/todo-request.schema';

/** 수정 폼에서 바뀐 칸. 없는 칸은 서버가 그대로 둔다(생략은 유지, null은 비우기) */
export interface TodoUpdateChanges {
  input: UpdateTodoInput;
  /** 생략은 규칙 유지, null은 반복 끝내기 */
  repeat?: TodoRepeat | null;
}
