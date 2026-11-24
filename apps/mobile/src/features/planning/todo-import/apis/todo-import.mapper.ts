import {
  receiveTodoImportItemsRequestSchema,
  type ReceiveTodoImportItemsRequest,
  type StartTodoImportRequest,
  startTodoImportRequestSchema,
  type TodoImport as TodoImportDto,
} from '@aido/api/contracts/todo-import/v1';
import { dateKeySchema } from '@src/shared/date/date-key';
import { toInstant, toNullableInstant } from '@src/shared/date/instant';
import { uniqWith } from 'es-toolkit';
import { match } from 'ts-pattern';

import type { ImportItem } from '../domains/todo-import-item.model';
import type { TodoImportSelection } from '../domains/todo-import-session.model';
import { type ImportTarget, TodoImportTargetPolicy } from '../domains/todo-import-target.model';
import type { TodoImport } from '../domains/todo-import.model';
import type { TodoImportFormValues } from '../schemas/todo-import-form.schema';
import { applyCategoryMode } from './todo-import-target.mapper';

export function toTodoImport(dto: TodoImportDto): TodoImport {
  return {
    ...dto,
    startDate: dateKeySchema.parse(dto.startDate),
    endDate: dateKeySchema.parse(dto.endDate),
    firstDate: dto.firstDate == null ? null : dateKeySchema.parse(dto.firstDate),
    undoableUntil: toNullableInstant(dto.undoableUntil),
    createdAt: toInstant(dto.createdAt),
    completedAt: toNullableInstant(dto.completedAt),
  };
}

/** 계약 스키마로 한 번 더 검증해 서버가 받지 않을 요청(대상 키 겹침·3,000개 초과)을 보내기 전에 막는다 */
export function toStartTodoImportRequest(selection: TodoImportSelection): StartTodoImportRequest {
  return startTodoImportRequestSchema.parse({ source: 'DEVICE_CALENDAR', ...selection });
}

export function toReceiveTodoImportItemsRequest(
  items: readonly ImportItem[],
): ReceiveTodoImportItemsRequest {
  return receiveTodoImportItemsRequestSchema.parse({ items });
}

function toTargetKey(target: ImportTarget, index: number) {
  return match(target)
    .with({ kind: 'EXISTING_CATEGORY' }, ({ categoryId }) => `category-${categoryId}`)
    .with({ kind: 'NEW_CATEGORY' }, () => `new-${index}`)
    .exhaustive();
}

/** 같은 기존 카테고리나 같은 이름의 새 카테고리를 고른 캘린더는 대상 하나를 함께 가리킨다 */
export function toTodoImportSelection(values: TodoImportFormValues): TodoImportSelection {
  const targets = applyCategoryMode(values.collections, values.targets, values);
  const chosen = values.collections.flatMap((collection) => {
    const target = targets[collection.collectionKey];
    return target == null ? [] : [{ collection, target }];
  });
  const uniqueTargets = uniqWith(
    chosen.map(({ target }) => target),
    TodoImportTargetPolicy.isSameTarget,
  ).map((target, index) => ({ target, targetKey: toTargetKey(target, index) }));
  const findTargetKey = (target: ImportTarget) =>
    uniqueTargets.find((unique) => TodoImportTargetPolicy.isSameTarget(unique.target, target))
      ?.targetKey ?? '';

  return {
    startDate: values.startDate,
    endDate: values.endDate,
    timeMode: values.timeMode,
    visibility: values.visibility,
    targets: uniqueTargets.map(({ target, targetKey }) => ({ ...target, targetKey })),
    collections: chosen.map(({ collection, target }) => ({
      collectionKey: collection.collectionKey,
      targetKey: findTargetKey(target),
      expectedItemCount: collection.itemCount,
    })),
  };
}
