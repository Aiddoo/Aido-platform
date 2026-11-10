import type { TodoVisibility } from "@aido/api/vocabulary";

import type { TodoScheduleProps } from "../../../shared/domain/todo-schedule.vo.js";
import type {
  Todo,
  TodoCreationPlan,
  TodoPersistenceSnapshot,
} from "../../../shared/domain/todo.aggregate.js";

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
  readonly scheduledLocalTime: string | null;
  readonly scheduledTime: Date | null;
}

export interface TodoOccurrenceAttachment {
  readonly occurrenceDate: string;
  readonly scheduledLocalTime: string | null;
  readonly scheduledTime: Date | null;
}

/** 시간대가 바뀌면 다시 계산할 할 일. 벽시계가 빈 행은 옛 서버가 쓴 것이라 재배포 SQL이 채운다. */
export interface RebaseCandidate {
  readonly todoId: number;
  readonly startDate: string;
  readonly scheduledLocalTime: string | null;
  readonly scheduledTime: Date;
  readonly completed: boolean;
}

export interface RebaseCandidateQuery {
  readonly userId: string;
  /** id 순 커서. 지난 묶음의 마지막 id */
  readonly afterId: number | null;
  readonly limit: number;
}

export interface RebasedInstant {
  readonly todoId: number;
  readonly scheduledTime: Date;
}

export interface CreatedOccurrence {
  readonly todoId: number;
  readonly scheduledTime: Date | null;
}

/** Todo 부분 수정 영속화 패치. undefined 필드는 변경하지 않습니다(부분 수정 시맨틱). */
export type TodoUpdatePatch = Partial<TodoPersistenceSnapshot>;

/**
 * Todo 쓰기 리포지토리 포트 (애그리게잇 경계)
 *
 * 커맨드 핸들러가 영속 구현체에 의존하지 않도록 하는 쓰기 측 경계입니다.
 * 조회는 애그리게잇(Todo)을 반환하고, 응답 read model은 TodoReadRepositoryPort가 담당합니다.
 * 트랜잭션은 CLS(UnitOfWorkPort.run)로 전파되므로 tx 핸들을 전달하지 않습니다.
 */
export abstract class TodoRepositoryPort {
  abstract findByIdAndUserId(id: number, userId: string): Promise<Todo | null>;

  abstract create(data: TodoCreationPlan): Promise<Todo>;

  /** 인라인 하위 항목 일괄 생성(생성 트랜잭션 내부에서 호출) */
  abstract createInlineItems(todoId: number, items: readonly { title: string }[]): Promise<void>;

  /** 부분 수정 패치 영속화 (undefined 필드는 미변경) */
  abstract updateDetails(id: number, patch: TodoUpdatePatch): Promise<void>;

  abstract updateTitle(id: number, title: string): Promise<void>;

  abstract updateVisibility(id: number, visibility: TodoVisibility): Promise<void>;

  abstract updateSchedule(id: number, schedule: TodoScheduleProps): Promise<void>;

  abstract updateCategory(id: number, categoryId: number): Promise<void>;

  abstract delete(id: number): Promise<void>;

  abstract updateSortOrder(id: number, sortOrder: number): Promise<void>;

  /**
   * [from, to] 범위(둘 다 포함)의 sortOrder를 delta만큼 일괄 이동.
   * to가 null이면 from 이상 전체.
   */
  abstract shiftSortOrders(
    userId: string,
    from: number,
    to: number | null,
    delta: number,
  ): Promise<void>;

  /**
   * 회차를 한 문장으로 만든다. 같은 (seriesId, occurrenceDate)는 건너뛰어(ON CONFLICT DO NOTHING)
   * 재시도에 멱등이고, 실제로 만든 행만 돌려준다. 체크리스트도 만든 행에만 복사한다.
   */
  abstract insertOccurrences(
    plans: readonly TodoOccurrencePlan[],
    seriesId: string,
    checklist: readonly { title: string }[],
  ): Promise<readonly CreatedOccurrence[]>;

  /** fromDate 이후(포함) 회차를 회차 날짜 순으로. 옮긴 회차도 원래 회차 날짜로 찾는다. */
  abstract findOccurrencesFrom(
    seriesIds: readonly string[],
    fromDate: string,
  ): Promise<readonly OccurrenceRow[]>;

  /** fromDate 이후(포함) 미완료 회차의 내용을 함께 고친다. 완료한 회차는 기록이라 두지 않는다. */
  abstract updateFollowingOccurrences(
    seriesId: string,
    fromDate: string,
    patch: OccurrencePatch,
  ): Promise<void>;

  /** 회차마다 값이 다른 시각을 한 문장으로 저장한다. */
  abstract updateOccurrenceTimes(times: readonly OccurrenceTime[]): Promise<void>;

  /** 할 일 id를 유지한 채 다른 규칙으로 옮겨 댓글·진행을 보존한다. */
  abstract reassignOccurrences(todoIds: readonly number[], toSeriesId: string): Promise<void>;

  /** 새 규칙에 없는 날짜의 회차를 맞는 날짜로 옮긴다. */
  abstract moveOccurrence(todoId: number, occurrence: TodoOccurrenceAttachment): Promise<void>;

  /** 재계산 대상을 id 순으로 잠그고 최신 값을 읽는다. 활성 UoW 안에서 호출한다. */
  abstract lockRebaseCandidates(query: RebaseCandidateQuery): Promise<readonly RebaseCandidate[]>;

  /** 순간만 한 문장으로 다시 쓴다. 벽시계·종일·updatedAt은 사용자가 고친 값이 아니라 그대로 둔다. */
  abstract updateRebasedInstants(instants: readonly RebasedInstant[]): Promise<void>;

  /** 단일 할 일을 규칙의 첫 회차로 삼는다. */
  abstract attachToSeries(
    todoId: number,
    seriesId: string,
    occurrence: TodoOccurrenceAttachment,
  ): Promise<void>;

  /** 규칙들의 fromDate 이후 회차를 지우고 지운 id를 돌려준다. 완료 회차는 includeCompleted일 때만 지운다. */
  abstract deleteOccurrences(query: {
    readonly userId: string;
    readonly seriesIds: readonly string[];
    readonly fromDate?: string;
    readonly includeCompleted: boolean;
  }): Promise<readonly number[]>;

  abstract deleteMany(todoIds: readonly number[]): Promise<void>;

  /** 카테고리 한도에 세는 수: 반복 아닌 미완료 + 진행 중 규칙 1개당 1 */
  abstract countCategoryUsage(userId: string, categoryId: number): Promise<number>;

  abstract getMaxSortOrder(userId: string): Promise<number>;

  // ===== 하위 항목 (체크리스트) =====

  abstract createItem(todoId: number, data: { title: string; sortOrder: number }): Promise<void>;

  abstract updateItem(itemId: number, data: { title?: string; completed?: boolean }): Promise<void>;

  abstract deleteItem(itemId: number): Promise<void>;

  /** 배열 인덱스가 새 sortOrder가 되도록 일괄 재정렬 */
  abstract reorderItems(itemIds: readonly number[]): Promise<void>;
}
