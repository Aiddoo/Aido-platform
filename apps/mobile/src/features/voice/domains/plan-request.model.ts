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

export const PlanRequestPolicy = { prepare: preparePlanRequest } as const;
