import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoId } from "../../../shared/domain/todo-id.vo.js";

export interface TodoViewRecord {
  /** 이번 호출로 처음 본 사람이면 true다. 같은 사람은 한 번만 센다. */
  readonly recorded: boolean;
  readonly viewCount: number;
}

/** 다시 센 할 일 하나의 지워지지 않은 댓글 수 */
export interface TodoCommentCount {
  readonly todoId: number;
  readonly commentCount: number;
}

/**
 * 할 일의 댓글 수·조회 수를 바꾸는 유일한 문이다. 댓글·조회는 engagement가 소유하지만 숫자 칸은
 * Todo 행에 있어 planning이 쓴다. 활성 트랜잭션 안에서 부르면 함께 커밋된다.
 */
export abstract class TodoEngagementCounterPort {
  /** 없는 할 일이면 실패한다. */
  abstract increaseCommentCount(todoId: TodoId, amount: number): Promise<void>;
  /** 0 아래로 내리지 않는다. 줄였으면 true다. */
  abstract decrementCommentCount(todoId: TodoId): Promise<boolean>;
  /** 처음 보는 사람이면 기록하고 조회 수를 1 올린다. 없는 할 일이면 실패한다. */
  abstract recordView(todoId: TodoId, viewerId: UserId): Promise<TodoViewRecord>;
  /**
   * 댓글 수를 다시 세기 전에 할 일 행을 id 순서로 잠근다. 댓글 작성의 증가가 이 잠금을 기다려
   * 다시 센 절대값과 동시 증가가 서로 덮어쓰지 않는다.
   */
  abstract lockCounters(todoIds: readonly TodoId[]): Promise<void>;
  /** 다시 센 댓글 수로 바꾼다. 같은 값인 할 일은 건드리지 않는다. */
  abstract replaceCommentCounts(counts: readonly TodoCommentCount[]): Promise<void>;
}
