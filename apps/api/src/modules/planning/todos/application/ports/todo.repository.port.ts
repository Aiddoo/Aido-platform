import type { TodoVisibility } from "@aido/api/vocabulary";

import type { TodoId } from "../../../shared/domain/todo-id.vo.js";
import type { TodoItemId } from "../../../shared/domain/todo-item-id.vo.js";
import type { TodoItem } from "../../../shared/domain/todo-item.entity.js";
import type { TodoScheduleProps } from "../../../shared/domain/todo-schedule.vo.js";
import type { Todo } from "../../../shared/domain/todo.aggregate.js";
import type { TodoOccurrenceDraft } from "../../../todo-series/domain/todo-series.aggregate.js";

/** nextIds로 받은 id와 사용자 최대값 뒤 순서를 붙인 회차 */
export interface TodoOccurrencePlan extends TodoOccurrenceDraft {
  readonly id: TodoId;
  readonly sortOrder: number;
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
  readonly scheduledTime: Temporal.Instant | null;
}

export interface TodoOccurrenceAttachment {
  readonly occurrenceDate: string;
  readonly scheduledLocalTime: string | null;
  readonly scheduledTime: Temporal.Instant | null;
}

/** 시간대가 바뀌면 다시 계산할 할 일. 벽시계가 빈 행은 옛 서버가 쓴 것이라 재배포 SQL이 채운다. */
export interface RebaseCandidate {
  readonly todoId: number;
  readonly startDate: string;
  readonly scheduledLocalTime: string | null;
  readonly scheduledTime: Temporal.Instant;
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
  readonly scheduledTime: Temporal.Instant;
}

export interface CreatedOccurrence {
  readonly todoId: number;
  readonly scheduledTime: Temporal.Instant | null;
}

/** 부분 수정 패치. undefined 필드는 바꾸지 않는다. */
export interface TodoUpdatePatch {
  readonly title?: string;
  readonly categoryId?: number;
  readonly startDate?: Temporal.PlainDate;
  readonly endDate?: Temporal.PlainDate | null;
  readonly scheduledLocalTime?: string | null;
  readonly scheduledTime?: Temporal.Instant | null;
  readonly isAllDay?: boolean;
  readonly visibility?: TodoVisibility;
  readonly completed?: boolean;
  readonly completedAt?: Temporal.Instant | null;
}

/**
 * 할 일 쓰기 저장소. 조회 응답은 TodoReadRepositoryPort가 맡는다.
 * 수정은 고친 칸만 쓴다. 다른 잠금으로 sortOrder를 미는 순서 바꾸기와 겹쳐도 덮어쓰지 않게 하려는 것이다.
 */
export abstract class TodoRepositoryPort {
  abstract nextId(): Promise<TodoId>;

  /** 한 문장으로 count개를 오름차순으로 받는다. */
  abstract nextIds(count: number): Promise<TodoId[]>;

  abstract nextItemId(): Promise<TodoItemId>;

  abstract findByIdAndUserId(id: number, userId: string): Promise<Todo | null>;

  /** 새 할 일 행만 쓴다. 생성 때의 하위 항목은 createInlineItems로 함께 쓴다. */
  abstract insert(todo: Todo): Promise<void>;

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

  abstract insertItem(todoId: number, item: TodoItem): Promise<void>;

  abstract updateItem(itemId: number, data: { title?: string; completed?: boolean }): Promise<void>;

  abstract deleteItem(itemId: number): Promise<void>;

  /** 배열 인덱스가 새 sortOrder가 되도록 일괄 재정렬 */
  abstract reorderItems(itemIds: readonly number[]): Promise<void>;
}
