import type { FriendTodoMenuAction } from '@src/features/planning/todo/components/friend-todo-list';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import type { FriendUser } from '@src/features/social/friend/domains/friend.model';
import type { DateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';

import { TodoNudgePolicy } from '../domains/todo-nudge.model';
import { useOpenTodoNudge } from './use-open-todo-nudge';

/** 친구 할 일 행 메뉴의 콕. 줄의 콕 버튼처럼 오늘의 끝나지 않은 할 일에만 둔다 */
export function useFriendTodoNudgeMenuAction({
  friend,
  selectedDateKey,
}: {
  friend: FriendUser;
  selectedDateKey: DateKey;
}) {
  const { t } = useTranslation(['todo', 'friend']);
  const todayKey = useTodayKey();
  const openTodoNudge = useOpenTodoNudge();
  const receiver = { id: friend.id, displayName: friend.name ?? t('friend:fallbackName') };

  return (todo: Todo): FriendTodoMenuAction | null => {
    if (!TodoNudgePolicy.canNudgeTodoOnDate(todo, selectedDateKey, todayKey)) {
      return null;
    }
    return {
      label: t('todo:friendTodo.nudge'),
      icon: 'hand.point.up.left',
      onPress: () => openTodoNudge({ receiver, todo }),
    };
  };
}
