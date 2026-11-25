import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import type { FriendUser } from '@src/features/social/friend/domains/friend.model';
import type { DateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import { getTouchTargetInset } from '@src/shared/ui';

import { TodoNudgePolicy } from '../domains/todo-nudge.model';
import { TodoNudgeButton } from './todo-nudge-button';

/** 줄에 맞춘 높이(py-1.5 위아래 12 + 가장 작은 글꼴 단계의 발바닥 아이콘 16) */
const COMPACT_ACTION_HEIGHT = 12 + 16;
/** 가로는 버튼(min-w-11)이 이미 44이고 옆 버튼과 겹치지 않게 넓히지 않는다 */
const COMPACT_ACTION_HIT_SLOP = {
  top: getTouchTargetInset(COMPACT_ACTION_HEIGHT),
  bottom: getTouchTargetInset(COMPACT_ACTION_HEIGHT),
  left: 0,
  right: 0,
};

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
