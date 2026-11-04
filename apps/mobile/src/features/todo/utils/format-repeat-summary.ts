import { t } from '@src/shared/i18n';
import { formatDaysOfWeek } from '@src/shared/utils/date';
import { type DateFormatContext, formatDateKeyLabel } from '@src/shared/utils/date-format';
import { match } from 'ts-pattern';

import {
  type TodoRepeat,
  type TodoRepeatEnd,
  TodoRepeatPolicy,
} from '../domains/todo-repeat.model';

const WEEKDAY_SEPARATOR = '·';
const SUMMARY_SEPARATOR = ' · ';

function formatFrequency(repeat: TodoRepeat): string {
  const days =
    repeat.frequency === 'WEEKLY' ? formatDaysOfWeek(repeat.weekdays, WEEKDAY_SEPARATOR) : '';

  return match(TodoRepeatPolicy.getKind(repeat))
    .with('DAILY', () => t('todo:repeat.summary.DAILY'))
    .with('WEEKDAYS', () => t('todo:repeat.summary.WEEKDAYS'))
    .with('WEEKLY', () => t('todo:repeat.summary.WEEKLY', { days }))
    .with('BIWEEKLY', () => t('todo:repeat.summary.BIWEEKLY', { days }))
    .with('MONTHLY', () =>
      t('todo:repeat.summary.MONTHLY', {
        day: repeat.frequency === 'MONTHLY' ? repeat.monthDay : 0,
      }),
    )
    .with('NONE', () => '')
    .exhaustive();
}

function formatEnd(end: TodoRepeatEnd, context: DateFormatContext): string | null {
  return match(end)
    .with({ type: 'NEVER' }, () => null)
    .with({ type: 'UNTIL' }, ({ date }) =>
      t('todo:repeat.summary.untilSuffix', { date: formatDateKeyLabel(date, 'monthDay', context) }),
    )
    .with({ type: 'COUNT' }, ({ count }) => t('todo:repeat.summary.countSuffix', { count }))
    .exhaustive();
}

/** "매주 월·수·금", "매일 · 12월 31일까지", "매월 15일 · 10회" */
export function formatRepeatSummary(repeat: TodoRepeat, context: DateFormatContext): string {
  return [formatFrequency(repeat), formatEnd(repeat.end, context)]
    .filter((part) => part != null && part !== '')
    .join(SUMMARY_SEPARATOR);
}
