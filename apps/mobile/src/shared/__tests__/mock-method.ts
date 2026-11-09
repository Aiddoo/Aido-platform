/**
 * 포트 메서드 하나를 흉내 내는 `jest.fn`. 인자와 반환 타입이 포트의 메서드에서 와서
 * 포트가 바뀌면 stub의 기본값도 컴파일되지 않는다(`jest.fn()`은 무엇이든 받는다).
 */
export function mockMethod<TMethod extends (...args: never[]) => unknown>(
  implementation?: (...args: Parameters<TMethod>) => ReturnType<TMethod>,
) {
  return jest.fn<ReturnType<TMethod>, Parameters<TMethod>>(implementation);
}
