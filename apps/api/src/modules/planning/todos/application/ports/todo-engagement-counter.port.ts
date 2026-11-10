export interface TodoViewRecord {
  /** 이번 호출로 처음 본 사람이면 true다. 같은 사람은 한 번만 센다. */
  readonly recorded: boolean;
  readonly viewCount: number;
}

/**
 * 할 일의 댓글 수·조회 수를 바꾸는 유일한 문이다. 댓글·조회는 engagement가 소유하지만 숫자 칸은
 * Todo 행에 있어 planning이 쓴다. 활성 트랜잭션 안에서 부르면 함께 커밋된다.
 */
export abstract class TodoEngagementCounterPort {
  /** 없는 할 일이면 실패한다. */
  abstract increaseCommentCount(todoId: number, amount: number): Promise<void>;
  /** 0 아래로 내리지 않는다. 줄였으면 true다. */
  abstract decrementCommentCount(todoId: number): Promise<boolean>;
  /** 처음 보는 사람이면 기록하고 조회 수를 1 올린다. 없는 할 일이면 실패한다. */
  abstract recordView(todoId: number, viewerId: string): Promise<TodoViewRecord>;
}
