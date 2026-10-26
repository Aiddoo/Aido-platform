import type { WindowSizeClass } from '@src/shared/utils/window-size-class';

import { createFeedHref } from '../feed-route';

interface TodoDetailTarget {
  todoId: number;
  /** 열 때 바로 보일 댓글 대화 */
  comment?: string;
  /** 친구의 할 일이면 그 친구. 내 할 일이거나 모르면 비운다 */
  friendId?: string;
  /** 할 일 날짜(YYYY-MM-DD). 모르면 피드의 기본 날짜다 */
  date?: string;
}

/**
 * 목록 밖(알림 등)에서 할 일 상세를 여는 곳. 목록에서 고를 때(`resolveFeedTodoSelection`)와 같은 기준으로
 * 접힌 화면은 상세 화면을 push하고, 펼친 화면은 피드 상세 pane에 고른다.
 * 펼친 화면의 목록 pane은 그 할 일의 주인(친구 피드)과 날짜를 보여 준다.
 */
export function createTodoDetailHref(
  windowSizeClass: WindowSizeClass,
  { todoId, comment, friendId, date }: TodoDetailTarget,
) {
  const commentParams = comment != null ? { comment } : {};

  if (windowSizeClass === 'compact') {
    return { pathname: '/todo/[todoId]', params: { todoId, ...commentParams } } as const;
  }

  const feedHref = createFeedHref({ friendId, date });
  return {
    pathname: feedHref.pathname,
    params: { ...feedHref.params, todoId, ...commentParams },
  } as const;
}
