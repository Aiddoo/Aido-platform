export const QUICK_PLAN_RESULT_REPLAY = Symbol("QUICK_PLAN_RESULT_REPLAY");
export const VOICE_NOTE_DIGEST_RESULT_REPLAY = Symbol("VOICE_NOTE_DIGEST_RESULT_REPLAY");

/**
 * 응답을 받지 못한 재요청에 돌려줄 결과. 서버는 말한 내용을 저장하지 않으므로 프로세스 메모리에 잠시만 둔다.
 * 재시작하거나 시간이 지나면 없고, 그때 호출자는 같은 행을 다시 열어 추가 차감 없이 다시 만든다.
 */
export interface PlanResultReplayPort<T> {
  save(userId: string, idempotencyKey: string, result: T): Promise<void>;
  find(userId: string, idempotencyKey: string): Promise<T | null>;
}
