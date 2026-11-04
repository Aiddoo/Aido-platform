import { shouldRenewPlanKey } from './voice.error';

/** 같은 요청을 다시 보낼 때 처음 만든 멱등 키를 다시 쓰기 위해 요청과 키를 함께 든다 */
export interface PreparedPlanRequest<TInput> {
  fingerprint: string;
  idempotencyKey: string;
  input: TInput;
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
 * 실패한 요청의 키를 다음에도 쓸지. 키를 바꿔야 하는 오류면 null이라 다음 `preparePlanRequest`가 새 키를 만든다.
 * AI_1317 뒤의 새 키는 횟수를 한 번 더 쓰므로 자동으로 다시 보내지 않고 사용자가 누를 때만 쓴다.
 */
export function getPlanRequestAfterFailure<TInput>(
  request: PreparedPlanRequest<TInput> | null,
  error: unknown,
): PreparedPlanRequest<TInput> | null {
  return shouldRenewPlanKey(error) ? null : request;
}

export const PlanRequestPolicy = {
  prepare: preparePlanRequest,
  getAfterFailure: getPlanRequestAfterFailure,
} as const;
