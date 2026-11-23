import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryId } from "../../../todo-categories/domain/todo-category-id.vo.js";
import type { TodoId } from "../../domain/todo-id.vo.js";
import type { TodoItemId } from "../../domain/todo-item-id.vo.js";
import type { Todo } from "../../domain/todo.aggregate.js";

// 시간대가 바뀌면 다시 계산할 할 일. 벽시계가 빈 행은 옛 서버가 쓴 것이라 재배포 SQL이 채운다
export interface RebaseCandidate {
  readonly todoId: TodoId;
  readonly startDate: Temporal.PlainDate;
  readonly scheduledLocalTime: string | null;
  readonly scheduledTime: Temporal.Instant;
  readonly completed: boolean;
}

export interface RebaseCandidateQuery {
  readonly userId: UserId;
  // id 순 커서. 지난 묶음의 마지막 id다
  readonly afterId: TodoId | null;
  readonly limit: number;
}

export interface RebasedInstant {
  readonly todoId: TodoId;
  readonly scheduledTime: Temporal.Instant;
}

type TodoSortNeighbor = "previous" | "next";

export type TodoSortEdge = "first" | "last";

// 할 일 쓰기 저장소. 조회 응답은 TodoReadRepositoryPort, 반복 회차 묶음은 TodoOccurrenceWriterPort가 맡는다.
// 순서·시간대 재계산은 그 사용자 할 일 수백 행을 한 문장으로 옮기는 묶음 경로라 이름 있는 메서드로 둔다
export interface TodoSortNeighborQuery {
  readonly from: { readonly id: TodoId; readonly sortOrder: number };
  readonly direction: TodoSortNeighbor;
  readonly excludeId: TodoId;
}

export abstract class TodoRepositoryPort {
  abstract nextId(): Promise<TodoId>;

  abstract nextItemId(): Promise<TodoItemId>;

  abstract findByIdAndUserId(todoId: TodoId, userId: UserId): Promise<Todo | null>;

  // save할 UseCase는 이것으로 읽는다. 행을 잠그고 최신 값을 읽어, 순서 다시 매기기·회차 묶음·카테고리 옮기기·
  // 시간대 재계산이 같은 행을 쓰는 동안 기다렸다가 그 값 위에 저장한다(다른 할 일 요청은 막지 않는다)
  abstract lockByIdAndUserId(todoId: TodoId, userId: UserId): Promise<Todo | null>;

  // 새 할 일 행만 쓴다. 생성 때 체크리스트는 createInlineItems가 한 문장으로 넣는다
  abstract insert(todo: Todo): Promise<void>;

  abstract createInlineItems(todoId: TodoId, items: readonly { title: string }[]): Promise<void>;

  // 있는 행의 Aggregate 칸과 하위 항목만 쓴다. 댓글·조회 수는 engagement가 TodoEngagementCounterPort로 고친다.
  // upsert하지 않는다. 카테고리 함께 지우기가 지운 행을 기다린 저장이 되살리지 않고 부재 오류로 롤백된다
  abstract save(todo: Todo): Promise<void>;

  abstract delete(todo: Todo): Promise<void>;

  // (sortOrder, id) 순서로 볼 때 from 바로 앞·뒤 할 일의 sortOrder. 옮기는 할 일은 건너뛰고 없으면 null이다
  abstract findAdjacentSortOrder(
    userId: UserId,
    neighbor: TodoSortNeighborQuery,
  ): Promise<number | null>;

  // excludeId를 뺀 그 사용자 할 일의 가장 앞·끝 sortOrder. 없으면 null이다
  abstract findEdgeSortOrder(
    userId: UserId,
    edge: TodoSortEdge,
    excludeId: TodoId,
  ): Promise<number | null>;

  // 그 사용자 할 일을 지금 (sortOrder, id) 순서대로 간격을 두고 다시 번호 매긴다
  abstract renumberSortOrders(userId: UserId): Promise<void>;

  // 할 일이 없으면 -1이다
  abstract getMaxSortOrder(userId: UserId): Promise<number>;

  // 카테고리 한도에 세는 수: 반복 아닌 미완료 + 진행 중 규칙 1개당 1
  abstract countCategoryUsage(userId: UserId, categoryId: TodoCategoryId): Promise<number>;

  // 재계산 대상을 id 순으로 잠그고 최신 값을 읽는다. 활성 UoW 안에서 호출한다
  abstract lockRebaseCandidates(query: RebaseCandidateQuery): Promise<readonly RebaseCandidate[]>;

  // 순간만 한 문장으로 다시 쓴다. 벽시계·종일·updatedAt은 사용자가 고친 값이 아니라 그대로 둔다
  abstract updateRebasedInstants(instants: readonly RebasedInstant[]): Promise<void>;
}
