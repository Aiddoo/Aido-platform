import { isFriendFeedUnavailableError } from '../../domains/todo.error';
import { useFeedDateKey } from '../../hooks/use-feed-params';
import { useFriendCalendarCompletions } from '../../hooks/use-friend-calendar-completions';
import { Calendar } from './calendar';

interface FriendCalendarProps {
  /** 피드가 친구 목록에서 확인한 친구의 id. route 값은 더는 친구가 아닌 사람일 수 있어 그대로 읽지 않는다 */
  friendId: string;
}

export function FriendCalendar({ friendId }: FriendCalendarProps) {
  const [selectedDateKey] = useFeedDateKey();
  const calendar = useFriendCalendarCompletions({
    friendUserId: friendId,
    dateKey: selectedDateKey,
  });
  // 친구가 끊어 볼 수 없게 된 상태는 다시 시도해도 같고, 아래 할 일 목록이 한 번만 안내한다
  const shouldOfferRetry = calendar.isError && !isFriendFeedUnavailableError(calendar.error);

  return (
    <Calendar
      completions={calendar.completions}
      status={shouldOfferRetry ? <Calendar.Error onRetry={calendar.refetch} /> : undefined}
    />
  );
}
