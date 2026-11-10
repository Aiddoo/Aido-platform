/** 옛 토큰. 아직 옮기지 않은 소비 Context가 쓴다(같은 인스턴스 별칭으로 바인딩) */
export const TODO_TIMEZONE_REBASE_ENQUEUER = Symbol("TODO_TIMEZONE_REBASE_ENQUEUER");

/**
 * 저장 시간대가 바뀌면 앞으로 할 일의 재계산 작업을 등록한다.
 * 이벤트 발행은 내구성이 없어 변경을 놓칠 수 있으므로 시간대 변경과 한 트랜잭션에서 호출한다.
 */
export abstract class TodoTimezoneRebaseEnqueuerPort {
  abstract enqueueRebase(userId: string, at: Date): Promise<void>;
}
