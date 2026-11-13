import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryId } from "../../../categories/domain/todo-category-id.vo.js";
import type { TodoId } from "../../../shared/domain/todo-id.vo.js";
import type { TodoSeriesId } from "../../../todo-series/domain/todo-series-id.vo.js";
import type { FriendTodoReadModel, TodoReadModel } from "../read-models/todo.read-model.js";

export interface FindTodosParams {
  readonly userId: UserId;
  readonly cursor?: number;
  readonly size: number;
  readonly completed?: boolean;
  readonly categoryId?: TodoCategoryId;
  readonly startDate?: Temporal.PlainDate;
  readonly endDate?: Temporal.PlainDate;
}

export interface FindFriendTodosParams {
  readonly friendUserId: UserId;
  readonly cursor?: number;
  readonly size: number;
  readonly startDate?: Temporal.PlainDate;
  readonly endDate?: Temporal.PlainDate;
}

/**
 * Todo 읽기 리포지토리 포트 (조회 측)
 *
 * 쿼리 핸들러와 "쓰기 후 응답 조회"가 사용합니다. 애그리게잇을 거치지 않고
 * 응답 계약(`@aido/api`의 Todo) read model을 직접 반환합니다(성능·계층 분리).
 */
/** 홈 위젯 요약용 경량 read model (미완료 우선 정렬) */
export interface TodaySummaryTodoRow {
  id: number;
  title: string;
  completed: boolean;
  categoryColor: string;
}

export abstract class TodoReadRepositoryPort {
  abstract findByIdAndUserId(id: TodoId, userId: UserId): Promise<TodoReadModel | null>;

  /** 소유자만 알면 되는 자리 — 목록 캐시 키가 소유자 기준이라 이 한 컬럼이면 충분하다. */
  abstract findOwnerId(id: TodoId): Promise<string | null>;

  /** 반복 할 일의 회차 전체 (sortOrder asc — 생성 순서와 동일) */
  abstract findManyBySeriesId(userId: UserId, seriesId: TodoSeriesId): Promise<TodoReadModel[]>;

  abstract findManyByUserId(params: FindTodosParams): Promise<TodoReadModel[]>;

  abstract findPublicTodosByUserId(params: FindFriendTodosParams): Promise<FriendTodoReadModel[]>;

  /** 카테고리 한도에 세는 수: 반복 아닌 미완료 + 진행 중 규칙 1개당 1 */
  abstract countCategoryUsage(userId: UserId, categoryId: TodoCategoryId): Promise<number>;

  /** 완료한 할 일 수. limit에서 세기를 멈춰 min(실제 수, limit)이다 */
  abstract countCompletedByUser(userId: UserId, limit: number): Promise<number>;

  abstract existsByUserId(userId: UserId): Promise<boolean>;

  abstract existsCompletedByUserId(userId: UserId): Promise<boolean>;

  abstract getTodayTodoStats(
    userId: UserId,
    today: Temporal.PlainDate,
  ): Promise<{ total: number; completed: number }>;

  /**
   * 오늘 할 일 상위 목록 (홈 위젯용) — 미완료 우선, 이후 카테고리/정렬 순.
   * 단일 쿼리 + 필요한 컬럼만 조회한다 (전체 read model 대비 경량).
   */
  abstract findTodayTopTodos(
    userId: UserId,
    today: Temporal.PlainDate,
    limit: number,
  ): Promise<TodaySummaryTodoRow[]>;
}
