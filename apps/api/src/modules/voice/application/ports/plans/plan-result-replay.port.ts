export const QUICK_PLAN_RESULT_REPLAY = Symbol("QUICK_PLAN_RESULT_REPLAY");
export const VOICE_NOTE_DIGEST_RESULT_REPLAY = Symbol("VOICE_NOTE_DIGEST_RESULT_REPLAY");

/**
 * 응답을 받지 못한 재요청에 돌려줄 결과. 서버는 말한 내용을 저장하지 않으므로 프로세스 메모리에 잠시만 둔다.
 * 재시작하거나 시간이 지나면 없고, 그때 호출자는 AI를 다시 부르지 않고 AI_1317로 답한다.
 */
export interface PlanResultReplayPort<T> {
  remember(userId: string, idempotencyKey: string, result: T): Promise<void>;
  recall(userId: string, idempotencyKey: string): Promise<T | null>;
}
