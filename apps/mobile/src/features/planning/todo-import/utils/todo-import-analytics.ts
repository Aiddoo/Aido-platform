import { diffDateKeysInDays } from '@src/shared/date/date-key';
import { sumBy } from 'es-toolkit';
import { match, P } from 'ts-pattern';

import type {
  TodoImportCountBucket,
  TodoImportFailureReason,
} from '../constants/todo-import.events';
import type { TodoImportSelection } from '../domains/todo-import-selection.model';
import type { TodoImport } from '../domains/todo-import.model';

/** 끝난 가져오기를 분석에 남길 결과. 아직 끝나지 않았거나 세지 않는 끝남이면 null이다 */
export function toTodoImportOutcome(
  todoImport: TodoImport,
): 'completed' | TodoImportFailureReason | null {
  return (
    match(todoImport.status)
      .returnType<'completed' | TodoImportFailureReason | null>()
      .with('COMPLETED', () => 'completed')
      // 되돌리기 실패는 가져오기 실패가 아니라 세지 않는다
      .with('FAILED', () => (todoImport.failureReason === 'UNDO_FAILED' ? null : 'server_failed'))
      .with('CANCELED', () => 'canceled')
      .with('ABANDONED', () => 'abandoned')
      .with(P.union('UPLOADING', 'QUEUED', 'RUNNING', 'UNDOING', 'UNDONE'), () => null)
      .exhaustive()
  );
}

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
