import type { TodoVisibility } from "@aido/api/vocabulary";

import type {
  Todo,
  TodoCreationPlan,
  TodoDetailsPatch,
} from "../../../domain/aggregates/todos/todo.aggregate.js";
import type { TodoScheduleProps } from "../../../domain/value-objects/todos/todo-schedule.vo.js";

export const TODO_REPOSITORY = Symbol("TODO_REPOSITORY");

export interface TodoOccurrencePlan extends TodoCreationPlan {
  readonly occurrenceDate: string;
  readonly createdAt: Date;
}

export interface CreatedOccurrence {
  readonly todoId: number;
  readonly scheduledTime: Date | null;
}

/**
 * Todo 부분 수정 영속화 패치
 *
 * 도메인 패치에 전이로 파생된 completedAt을 더한 형태입니다.
 * undefined 필드는 변경하지 않습니다(부분 수정 시맨틱).
 */
export type TodoUpdatePatch = TodoDetailsPatch & {
  completedAt?: Date | null;
};

/**
 * Todo 쓰기 리포지토리 포트 (애그리게잇 경계)
 *
 * 커맨드 핸들러가 영속 구현체에 의존하지 않도록 하는 쓰기 측 경계입니다.
 * 조회는 애그리게잇(Todo)을 반환하고, 응답 read model은 TodoReadRepositoryPort가 담당합니다.
 * 트랜잭션은 CLS(UnitOfWorkPort.run)로 전파되므로 tx 핸들을 전달하지 않습니다.
 */
export interface TodoRepositoryPort {
  findByIdAndUserId(id: number, userId: string): Promise<Todo | null>;

  create(data: TodoCreationPlan): Promise<Todo>;

  /** 인라인 하위 항목 일괄 생성(생성 트랜잭션 내부에서 호출) */
  createInlineItems(todoId: number, items: readonly { title: string }[]): Promise<void>;

  /** 완료 상태 등 애그리게잇 변경분 영속화 */
  updateCompletion(id: number, completed: boolean, completedAt: Date | null): Promise<void>;

  /** 부분 수정 패치 영속화 (undefined 필드는 미변경) */
  updateDetails(id: number, patch: TodoUpdatePatch): Promise<void>;

  updateTitle(id: number, title: string): Promise<void>;

  updateVisibility(id: number, visibility: TodoVisibility): Promise<void>;

  updateSchedule(id: number, schedule: TodoScheduleProps): Promise<void>;

  updateCategory(id: number, categoryId: number): Promise<void>;

  delete(id: number): Promise<void>;

  updateSortOrder(id: number, sortOrder: number): Promise<void>;

  /**
   * [from, to] 범위(둘 다 포함)의 sortOrder를 delta만큼 일괄 이동.
   * to가 null이면 from 이상 전체.
   */
  shiftSortOrders(userId: string, from: number, to: number | null, delta: number): Promise<void>;

  /**
   * 회차를 한 문장으로 만든다. 같은 (seriesId, occurrenceDate)는 건너뛰어(ON CONFLICT DO NOTHING)
   * 재시도에 멱등이고, 실제로 만든 행만 돌려준다. 체크리스트도 만든 행에만 복사한다.
   */
  insertOccurrences(
    plans: readonly TodoOccurrencePlan[],
    seriesId: string,
    checklist: readonly { title: string }[],
  ): Promise<readonly CreatedOccurrence[]>;

  /** 카테고리 한도에 세는 수: 반복 아닌 미완료 + 진행 중 규칙 1개당 1 */
  countCategoryUsage(userId: string, categoryId: number): Promise<number>;

  getMaxSortOrder(userId: string): Promise<number>;

  // ===== 하위 항목 (체크리스트) =====

  createItem(todoId: number, data: { title: string; sortOrder: number }): Promise<void>;

  updateItem(itemId: number, data: { title?: string; completed?: boolean }): Promise<void>;

  deleteItem(itemId: number): Promise<void>;

  /** 배열 인덱스가 새 sortOrder가 되도록 일괄 재정렬 */
  reorderItems(itemIds: readonly number[]): Promise<void>;
}
