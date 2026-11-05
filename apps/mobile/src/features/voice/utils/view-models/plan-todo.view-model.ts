/** 계획 카드의 회색 줄. 날짜(오늘이 아니고 반복이 아닐 때) · 시간 · 반복 순서로 있는 것만 잇는다 */
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

/** 제목 없이 내용만 있는 메모는 내용을 이름처럼 보인다 */
export function getPlanMemoLabel(memo: { title: string; content: string }) {
  return memo.title === '' ? memo.content : memo.title;
}
