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

import type { TodoImportItem } from '../domains/todo-import-item.model';
import { TodoImportPlanPolicy } from '../domains/todo-import-plan.model';
import type { TodoImportSelection } from '../domains/todo-import-selection.model';
import { type TodoImportTarget, TodoImportTargetPolicy } from '../domains/todo-import-target.model';
import type { TodoImport } from '../domains/todo-import.model';
import type { TodoImportFormValues } from '../schemas/todo-import-form.schema';

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

// 계약 스키마로 한 번 더 검증해 서버가 받지 않을 요청(대상 키 겹침·3,000개 초과)을 보내기 전에 막는다
export function toStartTodoImportRequest(selection: TodoImportSelection): StartTodoImportRequest {
  return startTodoImportRequestSchema.parse({ source: 'DEVICE_CALENDAR', ...selection });
}

export function toReceiveTodoImportItemsRequest(
  items: readonly TodoImportItem[],
): ReceiveTodoImportItemsRequest {
  return receiveTodoImportItemsRequestSchema.parse({ items });
}

// 기존 카테고리는 id로, 새 카테고리는 대상 전체에서의 순번으로 짓는다
function toTargetKey(target: TodoImportTarget, index: number): string {
  return match(target)
    .with({ kind: 'EXISTING_CATEGORY' }, ({ categoryId }) => `category-${categoryId}`)
    .with({ kind: 'NEW_CATEGORY' }, () => `new-${index}`)
    .exhaustive();
}

// 넣을 곳은 카테고리 단계를 넘길 때 singleTarget에 고정돼 기본 넣을 곳 없이(null) 읽는다
export function toTodoImportSelection(values: TodoImportFormValues): TodoImportSelection {
  const targets = TodoImportPlanPolicy.getAssignedTargets(values, null);
  const chosen = values.collections.flatMap((collection) => {
    const target = targets[collection.collectionKey];
    return target == null ? [] : [{ collection, target }];
  });
  const uniqueTargets = uniqWith(
    chosen.map(({ target }) => target),
    (target, other) => TodoImportTargetPolicy.isSameTarget(target, other),
  );
  const getTargetKey = (target: TodoImportTarget) =>
    toTargetKey(
      target,
      uniqueTargets.findIndex((unique) => TodoImportTargetPolicy.isSameTarget(unique, target)),
    );

  return {
    startDate: values.range.startDate,
    endDate: values.range.endDate,
    timeMode: values.timeMode,
    visibility: values.visibility,
    targets: uniqueTargets.map((target) => ({ ...target, targetKey: getTargetKey(target) })),
    collections: chosen.map(({ collection, target }) => ({
      collectionKey: collection.collectionKey,
      targetKey: getTargetKey(target),
      expectedItemCount: collection.itemCount,
    })),
  };
}
