import { isPlanKeyConflictError } from './voice.error';

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
 * AI_1318은 같은 키로 다른 내용을 보낸 것이라 새 키를 쓴다. 그 밖(처리 중·네트워크·서버 오류)은 같은 키를 다시 보낸다.
 * 서버는 같은 키를 한 번만 차감하고, 결과를 잃었으면 추가 차감 없이 다시 만들어 준다.
 * 어느 경우도 자동으로 다시 보내지 않는다. 다음 요청은 사용자가 눌렀을 때만 간다.
 */
export function getPlanRequestAfterFailure<TInput>(
  request: PreparedPlanRequest<TInput> | null,
  error: unknown,
): PreparedPlanRequest<TInput> | null {
  return isPlanKeyConflictError(error) ? null : request;
}

export const PlanRequestPolicy = {
  preparePlanRequest,
  getPlanRequestAfterFailure,
} as const;
