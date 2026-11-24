import type { TodoImportStatus } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoImportId } from "../../domain/todo-import-id.vo.js";
import type { TodoImport } from "../../domain/todo-import.aggregate.js";

export interface StalledTodoImportQuery {
  readonly statuses: readonly TodoImportStatus[];
  readonly updatedBefore: Temporal.Instant;
  readonly limit: number;
}

export abstract class TodoImportRepositoryPort {
  abstract findByIdAndUserId(importId: TodoImportId, userId: UserId): Promise<TodoImport | null>;
  // 잡은 사용자 없이 가져오기 id만 받는다
  abstract findById(importId: TodoImportId): Promise<TodoImport | null>;
  abstract findByIdempotencyKey(userId: UserId, idempotencyKey: string): Promise<TodoImport | null>;
  abstract findActiveByUserId(userId: UserId): Promise<TodoImport | null>;
  // 오래 바뀌지 않은 순서다
  abstract listStalled(query: StalledTodoImportQuery): Promise<TodoImport[]>;
  /** 진행 중 가져오기가 이미 있으면 TodoImportAlreadyActiveError를 던진다 */
  abstract save(todoImport: TodoImport): Promise<void>;
  /** 끝난 지 오래된 가져오기를 limit개까지 지우고 지운 수를 준다. 임시 항목은 FK로 함께 지워진다 */
  abstract deleteEndedBefore(cutoff: Temporal.Instant, limit: number): Promise<number>;
}
