import { TodoCommentThreadPolicy } from '../../models/todo-comment.model';
import type { TodoComment } from '../../models/todo-comment.model';

export interface ThreadContinuity {
  continuesFromAbove: boolean;
  continuesBelow: boolean;
}

/**
 * 정책의 판정을 행마다 위·아래 플래그로 편다. 판정 자체는 하지 않는다.
 *
 * **한 이웃 쌍을 한 번만 묻는다** — 위 행의 아래 선과 아래 행의 위 선이 반드시 같은 값을
 * 갖게 하기 위해서다. 둘이 어긋나면 한쪽만 그려진 반쪽 선이 화면에 남는다.
 */
export function resolveThreadContinuity(comments: readonly TodoComment[]): ThreadContinuity[] {
  const links = comments.map((comment, index) =>
    TodoCommentThreadPolicy.continuesInto(comment, comments[index + 1]),
  );

  return comments.map((_comment, index) => ({
    continuesFromAbove: index > 0 && links[index - 1] === true,
    continuesBelow: links[index] === true,
  }));
}
