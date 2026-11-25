import { isFriendFeedUnavailableError } from '../../domains/todo.error';
import { useFeedDateKey, useFeedFriendId } from '../../hooks/use-feed-params';
import { useFriendCalendarCompletions } from '../../hooks/use-friend-calendar-completions';
import { Calendar } from './calendar';

/** 친구 피드의 달력. route의 친구는 더는 친구가 아닌 사람일 수 있어, 피드가 친구임을 확인한 뒤에만 그린다 */
export function FriendCalendar() {
  const [friendId] = useFeedFriendId();

  if (friendId == null) {
    return <Calendar />;
  }

  return <FriendCalendar.Contents friendId={friendId} />;
}

FriendCalendar.Contents = function Contents({ friendId }: { friendId: string }) {
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
};
