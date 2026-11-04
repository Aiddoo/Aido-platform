import { isPlanKeyConflictError, isPlanKeyExpiredError } from './voice.error';

/** 같은 요청을 다시 보낼 때 처음 만든 멱등 키를 다시 쓰기 위해 요청과 키를 함께 든다 */
export interface PreparedPlanRequest<TInput> {
  fingerprint: string;
  idempotencyKey: string;
  input: TInput;
  /** 이 키로 "다시 보낼 결과 없음"(AI_1317)을 이미 받았다 */
  hasExpired?: boolean;
}

interface PreparePlanRequestParams<TInput> {
  previous: PreparedPlanRequest<TInput> | null;
  input: TInput;
  createIdempotencyKey: () => string;
}

/** 내용이 같으면 이전 키를 다시 쓰고, 고쳐서 보내면 새 키를 만든다 */
export function preparePlanRequest<TInput>({
  previous,
  input,
  createIdempotencyKey,
}: PreparePlanRequestParams<TInput>): PreparedPlanRequest<TInput> {
  const fingerprint = JSON.stringify(input);
  if (previous?.fingerprint === fingerprint) {
    return previous;
  }
  return { fingerprint, idempotencyKey: createIdempotencyKey(), input };
}

/**
 * 실패한 요청의 키를 다음에도 쓸지. null이면 다음 `preparePlanRequest`가 새 키를 만든다.
 * - AI_1318: 같은 키로 다른 내용을 보냈으니 새 키를 쓴다.
 * - AI_1317: 서버는 같은 키로 다시 보내면 추가 차감 없이 다시 만든다. 새 키는 한 번 더 차감되므로 첫 번째는 같은 키를 유지하고,
 *   같은 키가 또 AI_1317이면 그 키로는 끝난 것이라 사용자가 누를 때 새 키를 쓴다(그대로 두면 글자가 있어도 정리할 길이 없다).
 * - 그 밖(처리 중·네트워크·서버 오류): 같은 키로 다시 보내 두 번 차감되지 않게 한다.
 * 어느 경우도 자동으로 다시 보내지 않는다. 다음 요청은 사용자가 눌렀을 때만 간다.
 */
export function getPlanRequestAfterFailure<TInput>(
  request: PreparedPlanRequest<TInput> | null,
  error: unknown,
): PreparedPlanRequest<TInput> | null {
  if (isPlanKeyConflictError(error)) {
    return null;
  }
  if (request != null && isPlanKeyExpiredError(error)) {
    return request.hasExpired === true ? null : { ...request, hasExpired: true };
  }
  return request;
}

export const PlanRequestPolicy = {
  prepare: preparePlanRequest,
  getAfterFailure: getPlanRequestAfterFailure,
} as const;
