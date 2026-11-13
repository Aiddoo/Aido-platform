import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import type { FriendUser } from '@src/features/social/friend/domains/friend.model';
import type { DateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';

import { TodoNudgePolicy } from '../domains/todo-nudge.model';
import { TodoNudgeButton } from './todo-nudge-button';

const COMPACT_ACTION_HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };

interface FriendTodoNudgeActionProps {
  todo: Todo;
  /** 목록이 한 번 읽은 친구와 보는 날짜를 넘긴다. 행마다 route를 읽지 않는다 */
  friend: FriendUser;
  selectedDateKey: DateKey;
}

/** 친구 할 일 줄의 콕 버튼. 오늘의 끝나지 않은 할 일에만 보인다 */
export function FriendTodoNudgeAction({
  todo,
  friend,
  selectedDateKey,
}: FriendTodoNudgeActionProps) {
  const { t } = useTranslation('friend');
  const todayKey = useTodayKey();
  const canNudgeTodo = TodoNudgePolicy.canNudgeTodoOnDate(todo, selectedDateKey, todayKey);

  if (!canNudgeTodo) {
    return null;
  }

  return (
    <TodoNudgeButton
      receiver={{ id: friend.id, displayName: friend.name ?? t('fallbackName') }}
      todo={todo}
      className="min-h-0 py-1.5"
      hitSlop={COMPACT_ACTION_HIT_SLOP}
    />
  );
}
