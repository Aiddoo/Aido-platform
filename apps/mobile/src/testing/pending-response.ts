/**
 * 진행 중 상태를 검증하려고 붙잡아 두는 HTTP 응답. 검증이 끝나면 `settle`로 `settledValue`를
 * 돌려줘야 TanStack mutation이 대기 상태로 남아 Jest 프로세스를 붙잡지 않는다.
 */
export function createPendingResponse<T>(settledValue: T) {
  const { promise, resolve } = Promise.withResolvers<T>();

  return { response: promise, settle: () => resolve(settledValue) };
}

/**
 * 헤더는 왔는데 본문이 끝나지 않는 JSON 응답. 프록시가 연결을 반쯤 끊으면 생긴다.
 * 검증이 끝나면 `finish`로 본문을 마저 보내 읽던 쪽이 남지 않게 한다.
 */
export function createStalledBodyResponse(status: number) {
  const encoder = new TextEncoder();
  let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const body = new ReadableStream<Uint8Array>({
    start: (controller) => {
      bodyController = controller;
    },
  });

  return {
    response: new Response(body, { status, headers: { 'Content-Type': 'application/json' } }),
    finish: (text: string) => {
      bodyController?.enqueue(encoder.encode(text));
      bodyController?.close();
    },
  };
}

type Settlement<T> = PromiseSettledResult<T> | { status: 'pending' };

/**
 * 기다리지 않고 Promise가 끝났는지 본다. 끝나지 않는 대기를 테스트 시간 초과 대신 바로 실패로 드러낸다.
 * 거부도 여기서 받으므로 처리되지 않은 거부가 남지 않는다.
 */
export function observeSettlement<T>(promise: Promise<T>): { readonly current: Settlement<T> } {
  const observed: { current: Settlement<T> } = { current: { status: 'pending' } };
  promise.then(
    (value) => {
      observed.current = { status: 'fulfilled', value };
    },
    (reason: unknown) => {
      observed.current = { status: 'rejected', reason };
    },
  );
  return observed;
}
