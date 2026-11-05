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

export interface OccurrenceRow {
  readonly todoId: number;
  readonly seriesId: string;
  readonly occurrenceDate: string;
  readonly startDate: string;
  readonly completed: boolean;
}

export interface OccurrencePatch {
  readonly title?: string;
  readonly categoryId?: number;
  readonly visibility?: TodoVisibility;
}

export interface OccurrenceTime {
  readonly todoId: number;
  readonly scheduledTime: Date | null;
}

export interface TodoOccurrenceAttachment {
  readonly occurrenceDate: string;
  readonly scheduledTime: Date | null;
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

  /** fromDate 이후(포함) 회차를 회차 날짜 순으로. 옮긴 회차도 원래 회차 날짜로 찾는다. */
  findOccurrencesFrom(
    seriesIds: readonly string[],
    fromDate: string,
  ): Promise<readonly OccurrenceRow[]>;

  /** fromDate 이후(포함) 미완료 회차의 내용을 함께 고친다. 완료한 회차는 기록이라 두지 않는다. */
  updateFollowingOccurrences(
    seriesId: string,
    fromDate: string,
    patch: OccurrencePatch,
  ): Promise<void>;

  /** 회차마다 값이 다른 시각을 한 문장으로 저장한다. */
  updateOccurrenceTimes(times: readonly OccurrenceTime[]): Promise<void>;

  /** 할 일 id를 유지한 채 다른 규칙으로 옮겨 댓글·진행을 보존한다. */
  reassignOccurrences(todoIds: readonly number[], toSeriesId: string): Promise<void>;

  /** 새 규칙에 없는 날짜의 회차를 맞는 날짜로 옮긴다. */
  moveOccurrence(todoId: number, occurrenceDate: string, scheduledTime: Date | null): Promise<void>;

  /** 단일 할 일을 규칙의 첫 회차로 삼는다. */
  attachToSeries(
    todoId: number,
    seriesId: string,
    occurrence: TodoOccurrenceAttachment,
  ): Promise<void>;

  /** 규칙들의 fromDate 이후 회차를 지우고 지운 id를 돌려준다. 완료 회차는 includeCompleted일 때만 지운다. */
  deleteOccurrences(query: {
    readonly userId: string;
    readonly seriesIds: readonly string[];
    readonly fromDate?: string;
    readonly includeCompleted: boolean;
  }): Promise<readonly number[]>;

  deleteMany(todoIds: readonly number[]): Promise<void>;

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
