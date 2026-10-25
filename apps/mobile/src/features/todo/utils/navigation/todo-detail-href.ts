import type { WindowSizeClass } from '@src/shared/utils/window-size-class';

interface TodoDetailTarget {
  todoId: number;
  /** 열 때 바로 보일 댓글 대화 */
  comment?: string;
}

/**
 * 목록 밖(알림 등)에서 할 일 상세를 여는 곳. 목록에서 고를 때(`resolveFeedTodoSelection`)와 같은 기준으로
 * 접힌 화면은 상세 화면을 push하고, 펼친 화면은 피드 상세 pane에 고른다.
 */
export function createTodoDetailHref(
  windowSizeClass: WindowSizeClass,
  { todoId, comment }: TodoDetailTarget,
) {
  const params = { todoId, ...(comment != null && { comment }) };

  if (windowSizeClass === 'compact') {
    return { pathname: '/todo/[todoId]', params } as const;
  }

  return { pathname: '/feed', params } as const;
}
