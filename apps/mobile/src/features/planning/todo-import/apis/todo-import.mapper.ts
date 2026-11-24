import {
  receiveTodoImportItemsRequestSchema,
  type ReceiveTodoImportItemsRequest,
  type StartTodoImportRequest,
  startTodoImportRequestSchema,
  type TodoImport as TodoImportDto,
} from '@aido/api/contracts/todo-import/v1';
import { dateKeySchema } from '@src/shared/date/date-key';
import { toInstant, toNullableInstant } from '@src/shared/date/instant';

import type { ImportItem } from '../domains/todo-import-item.model';
import type { TodoImportSelection } from '../domains/todo-import-session.model';
import type { TodoImport } from '../domains/todo-import.model';

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
