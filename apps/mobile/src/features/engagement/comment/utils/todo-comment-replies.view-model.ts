import { match, P } from 'ts-pattern';

import { TodoCommentPolicy, type TodoCommentThread } from '../domains/todo-comment.model';

/** 사용자가 직접 펼쳤는지(user), 답글을 올려 앱이 펼쳤는지(auto) */
export interface ThreadExpansion {
  isExpanded: boolean;
  source: 'user' | 'auto';
}

type ReplyFooter = 'viewMore' | 'hide' | 'none';

/** 접힌 묶음도 대표 답글 하나는 보이므로 그 이하로 불러온 묶음은 숨길 것이 없다 */
const COLLAPSED_VISIBLE_REPLY_COUNT = 1;

/** 사용자가 직접 펼친 묶음은 답글을 올려도 그 상태를 지킨다. 그래야 사용자가 연 "답글 숨기기"가 사라지지 않는다 */
export function expandThread(
  current: ThreadExpansion | undefined,
  source: ThreadExpansion['source'],
): ThreadExpansion {
  if (current?.isExpanded === true && current.source === 'user') {
    return current;
  }
  return { isExpanded: true, source };
}

/**
 * 펼친 묶음 아래 줄. 더 받을 답글이 있으면 "더 보기", 사용자가 펼쳤고 숨길 답글이 있으면 "숨기기", 그 밖에는 없다.
 * 답글을 올려 앱이 펼친 묶음은 사용자가 숨기기를 누를 이유가 없어 줄을 그리지 않는다.
 */
export function getReplyFooter(
  thread: TodoCommentThread,
  {
    loadedCount,
    hasNextPage,
    expansion,
  }: { loadedCount: number; hasNextPage: boolean; expansion: ThreadExpansion },
): ReplyFooter {
  return match({
    hasNextPage,
    hiddenCount: TodoCommentPolicy.getHiddenReplyCount(thread, loadedCount),
    source: expansion.source,
    loadedCount,
  })
    .returnType<ReplyFooter>()
    .with({ hasNextPage: true, hiddenCount: P.number.gt(0) }, () => 'viewMore')
    .with({ source: 'auto' }, () => 'none')
    .with({ loadedCount: P.number.lte(COLLAPSED_VISIBLE_REPLY_COUNT) }, () => 'none')
    .otherwise(() => 'hide');
}
