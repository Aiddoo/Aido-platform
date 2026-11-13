import type { DateKey } from '@src/shared/date/date-key';
import {
  type DateFormatContext,
  formatYearAwareDateKeyLabel,
} from '@src/shared/date/format/date-format';
import { formatDaysOfWeek } from '@src/shared/date/format/date-labels';
import { t } from '@src/shared/i18n';
import { toLanguageOfIntlLocale } from '@src/shared/i18n/app-locales';
import { compact } from 'es-toolkit';
import { match } from 'ts-pattern';

import {
  type TodoRepeat,
  type TodoRepeatEnd,
  TodoRepeatPolicy,
} from '../domains/todo-repeat.model';

const SUMMARY_SEPARATOR = ' · ';

export function formatRepeatCadence(
  repeat: TodoRepeat,
  language: string,
  { weekdaySeparator }: { weekdaySeparator?: string } = {},
): string {
  const days =
    repeat.frequency === 'WEEKLY'
      ? formatDaysOfWeek(repeat.weekdays, language, weekdaySeparator)
      : '';

  return match(TodoRepeatPolicy.getRepeatKind(repeat))
    .with('DAILY', () => t('todo:repeat.summary.DAILY'))
    .with('WEEKDAYS', () => t('todo:repeat.summary.WEEKDAYS'))
    .with('WEEKENDS', () => t('todo:repeat.summary.WEEKENDS'))
    .with('WEEKLY', () => t('todo:repeat.summary.WEEKLY', { days }))
    .with('BIWEEKLY', () => t('todo:repeat.summary.BIWEEKLY', { days }))
    .with('MONTHLY', () =>
      t('todo:repeat.summary.MONTHLY', {
        day: repeat.frequency === 'MONTHLY' ? repeat.monthDay : 0,
      }),
    )
    .exhaustive();
}

/** 반복 회차인데 규칙을 모르면(서버가 규칙을 내려 주지 않은 옛 회차) 주기 없이 반복이라고만 한다 */
export function formatRepeatRuleLabel(repeat: TodoRepeat | null, language: string): string {
  return repeat == null ? t('todo:chip.repeat') : formatRepeatCadence(repeat, language);
}

function formatEnd(
  end: TodoRepeatEnd,
  todayDateKey: DateKey,
  context: DateFormatContext,
): string | null {
  return match(end)
    .with({ type: 'NEVER' }, () => null)
    .with({ type: 'UNTIL' }, ({ date }) =>
      t('todo:repeat.summary.untilSuffix', {
        date: formatYearAwareDateKeyLabel(date, todayDateKey, context),
      }),
    )
    .with({ type: 'COUNT' }, ({ count }) => t('todo:repeat.summary.countSuffix', { count }))
    .exhaustive();
}

export function formatRepeatSummary(
  repeat: TodoRepeat,
  todayDateKey: DateKey,
  context: DateFormatContext,
): string {
  return compact([
    formatRepeatCadence(repeat, toLanguageOfIntlLocale(context.locale)),
    formatEnd(repeat.end, todayDateKey, context),
  ]).join(SUMMARY_SEPARATOR);
}
