import { diffDateKeysInDays } from '@src/shared/date/date-key';
import { sumBy } from 'es-toolkit';
import { match, P } from 'ts-pattern';

import type { TodoImportCountBucket } from '../constants/todo-import.events';
import type { TodoImportSelection } from '../domains/todo-import-session.model';

export function toTodoImportCountBucket(count: number): TodoImportCountBucket {
  return match(count)
    .with(0, () => '0' as const)
    .with(P.number.between(1, 10), () => '1_10' as const)
    .with(P.number.between(11, 50), () => '11_50' as const)
    .with(P.number.between(51, 200), () => '51_200' as const)
    .with(P.number.between(201, 1000), () => '201_1000' as const)
    .otherwise(() => '1001_plus' as const);
}

/** 제목·캘린더 이름·id는 싣지 않는다 */
export function toTodoImportStartedParams(selection: TodoImportSelection) {
  return {
    range_days: diffDateKeysInDays(selection.startDate, selection.endDate) + 1,
    calendar_count: selection.collections.length,
    item_bucket: toTodoImportCountBucket(
      sumBy(selection.collections, (collection) => collection.expectedItemCount),
    ),
    time_mode: selection.timeMode,
    visibility: selection.visibility,
    new_category_count: selection.targets.filter((target) => target.kind === 'NEW_CATEGORY').length,
  };
}
