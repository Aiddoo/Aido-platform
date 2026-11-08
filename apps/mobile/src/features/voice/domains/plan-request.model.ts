import { isPlanKeyConflictError } from './voice.error';

export interface PreparedPlanRequest<TInput> {
  fingerprint: string;
  idempotencyKey: string;
  input: TInput;
}

interface PreparePlanRequestInput<TInput> {
  previous: PreparedPlanRequest<TInput> | null;
  input: TInput;
  createIdempotencyKey: () => string;
}

export function preparePlanRequest<TInput>({
  previous,
  input,
  createIdempotencyKey,
}: PreparePlanRequestInput<TInput>): PreparedPlanRequest<TInput> {
  const fingerprint = JSON.stringify(input);
  if (previous?.fingerprint === fingerprint) {
    return previous;
  }
  return { fingerprint, idempotencyKey: createIdempotencyKey(), input };
}

// AI_1318(같은 키로 다른 내용)만 새 키(null)를 쓰고, 그 밖은 같은 키로 다시 보내 서버가 한 번만 차감한다
export function getRequestToRetry<TInput>(
  request: PreparedPlanRequest<TInput> | null,
  error: unknown,
): PreparedPlanRequest<TInput> | null {
  return isPlanKeyConflictError(error) ? null : request;
}

export const PlanRequestPolicy = {
  preparePlanRequest,
  getRequestToRetry,
} as const;
