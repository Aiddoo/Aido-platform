/**
 * 진행 중 상태를 검증하려고 붙잡아 두는 HTTP 응답. 검증이 끝나면 `settle`로 `settledValue`를
 * 돌려줘야 TanStack mutation이 대기 상태로 남아 Jest 프로세스를 붙잡지 않는다.
 */
export function createPendingResponse<T>(settledValue: T) {
  let settle: () => void = () => undefined;
  const response = new Promise<T>((resolve) => {
    settle = () => resolve(settledValue);
  });

  return { response, settle: () => settle() };
}
