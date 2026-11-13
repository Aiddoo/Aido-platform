import ky, { type AfterResponseHook } from 'ky';

type AfterResponseOutcome = Awaited<ReturnType<AfterResponseHook>>;

/**
 * 실제 ky 파이프라인으로 afterResponse 훅을 한 번 실행한다.
 *
 * ky가 만든 KyRequest·NormalizedOptions·KyResponse를 그대로 넘기므로 vendor 타입을 흉내 내지 않는다.
 * 훅의 반환값(재시도 마커 포함)은 ky에 돌려주지 않고 그대로 돌려줘 재시도가 일어나지 않는다.
 * ky는 fetch 응답을 복제해 넘기므로, 받은 응답을 그대로 통과시킨 경우는 호출부가 넘긴 응답으로 돌려준다.
 */
export async function runKyAfterResponseHook(
  hook: AfterResponseHook,
  request: Request,
  response: Response,
): Promise<AfterResponseOutcome> {
  let outcome: AfterResponseOutcome = undefined;
  const client = ky.create({
    fetch: async () => response,
    retry: 0,
    throwHttpErrors: false,
    hooks: {
      afterResponse: [
        async (state) => {
          const result = await hook(state);
          outcome = result === state.response ? response : result;
        },
      ],
    },
  });

  await client(request);
  return outcome;
}
