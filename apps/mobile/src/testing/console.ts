type ConsoleMethod = 'error' | 'warn';

/** 예상한 로그만 삼키고(`isExpected`를 주지 않으면 모두) 나머지는 그대로 찍는다. spy는 `restoreMocks`가 되돌린다 */
export function silenceConsole(
  method: ConsoleMethod,
  isExpected?: (messages: readonly unknown[]) => boolean,
) {
  const original = console[method];

  return jest.spyOn(console, method).mockImplementation((...messages: unknown[]) => {
    if (isExpected == null || isExpected(messages)) {
      return;
    }
    original(...messages);
  });
}
