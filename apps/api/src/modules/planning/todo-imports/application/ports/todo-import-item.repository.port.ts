import type { TodoImportId } from "../../domain/todo-import-id.vo.js";
import type { TodoImportItem } from "../../domain/todo-import-item.vo.js";
import type { TodoImportItemOutcome } from "../../domain/todo-imports.constants.js";

/**
 * 할 일로 만들 때까지 받아 둔 일정(작업 원장). 묶음 단위로 넣고 고르고 결과를 표시한다.
 * 활성 UoW 안에서 부른다.
 */
export abstract class TodoImportItemRepositoryPort {
  /** 이미 받은 sourceKey는 건너뛰고 새로 넣은 수를 준다 */
  abstract insertMany(importId: TodoImportId, items: readonly TodoImportItem[]): Promise<number>;
  // 가까운 날짜·이른 시각·sourceKey 순서다
  abstract listPending(importId: TodoImportId, limit: number): Promise<TodoImportItem[]>;
  abstract markOutcomes(
    importId: TodoImportId,
    outcomes: ReadonlyMap<string, TodoImportItemOutcome>,
  ): Promise<void>;
  abstract deleteByImportId(importId: TodoImportId): Promise<void>;
  /** 끝난 지 오래된 가져오기의 항목을 limit개까지 지우고 지운 수를 준다 */
  abstract deleteOfImportsEndedBefore(cutoff: Temporal.Instant, limit: number): Promise<number>;
}
