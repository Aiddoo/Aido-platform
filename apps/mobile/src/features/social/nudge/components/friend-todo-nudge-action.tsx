import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { useFeedDateKey } from '@src/features/planning/todo/hooks/use-feed-params';
import { useRouteFriendQuery } from '@src/features/social/friend/hooks/use-route-friend-query';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';

import { TodoNudgePolicy } from '../domains/todo-nudge.model';
import { TodoNudgeButton } from './todo-nudge-button';

const COMPACT_ACTION_HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };

interface FriendTodoNudgeActionProps {
  todo: Todo;
}

/** 친구 할 일 줄의 콕 버튼. 오늘의 끝나지 않은 할 일에만 보인다 */
export function FriendTodoNudgeAction({ todo }: FriendTodoNudgeActionProps) {
  const { t } = useTranslation('friend');
  const { data: friend } = useRouteFriendQuery();
  const [selectedDateKey] = useFeedDateKey();
  const todayKey = useTodayKey();
  const canNudgeTodo = TodoNudgePolicy.canNudgeTodoOnDate(todo, selectedDateKey, todayKey);

  if (!canNudgeTodo || friend == null) {
    return null;
  }

  return (
    <TodoNudgeButton
      receiver={{ ...friend, displayName: friend.name ?? t('fallbackName') }}
      todo={todo}
      className="min-h-0 py-1.5"
      hitSlop={COMPACT_ACTION_HIT_SLOP}
    />
  );
}
