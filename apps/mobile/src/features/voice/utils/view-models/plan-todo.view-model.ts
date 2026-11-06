export function getPlanTodoSubtitle({
  dateLabel,
  timeLabel,
  repeatLabel,
}: {
  dateLabel: string | null;
  timeLabel: string | null;
  repeatLabel: string | null;
}) {
  const parts = [dateLabel, timeLabel, repeatLabel].filter((part) => part != null);
  return parts.length === 0 ? null : parts.join(' · ');
}

/** 날짜는 반복이 아니고 오늘이 아닐 때만 보여 준다(반복은 시작일보다 반복 규칙이 중요하다) */
export function shouldShowPlanDate({
  hasRepeat,
  startDateKey,
  todayKey,
}: {
  hasRepeat: boolean;
  startDateKey: string;
  todayKey: string;
}) {
  return !hasRepeat && startDateKey !== todayKey;
}

export function parseScheduledTime(scheduledTime: string) {
  const [hour = 0, minute = 0] = scheduledTime.split(':').map(Number);
  return { hour, minute };
}

export function getPlanMemoLabel(memo: { title: string; content: string }) {
  return memo.title === '' ? memo.content : memo.title;
}
