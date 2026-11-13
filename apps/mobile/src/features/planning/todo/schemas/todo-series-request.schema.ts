import type { TodoRepeat, TodoUpdateScope } from '../domains/todo-repeat.model';

export interface TodoSeriesEditOptions {
  /** 반복 회차를 고칠 때만. 단일 할 일에 보내면 서버가 TODO_0844로 거절한다 */
  scope?: TodoUpdateScope;
  /** 생략은 유지, 값은 규칙 변경·반복 전환, null은 이 회차 뒤로 끝내기 */
  repeat?: TodoRepeat | null;
  /** 앞으로 만들 회차에 복사할 체크리스트. 서버는 THIS_AND_FOLLOWING에서만 받는다 */
  checklist?: readonly { title: string }[];
}
