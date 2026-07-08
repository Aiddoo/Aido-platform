/**
 * 던져진 값을 다루는 유틸.
 *
 * JS는 무엇이든 throw할 수 있다. RN 네이티브 브릿지와 서드파티 라이브러리는
 * `Error`가 아닌 값(문자열, `{ message }` 형태의 평범한 객체)을 던지기도 한다.
 *
 * 그래서 `instanceof Error`를 관문으로 삼으면 두 가지가 조용히 무너진다:
 * - `new Error(String(value))` → 객체가 `"[object Object]"`가 되어 리포터에 내용이 사라진다
 * - `value instanceof Error ? value : undefined` → 에러가 통째로 버려진다
 *
 * 값의 **모양**이 아니라 **내용**으로 판단한다.
 */

/** 순환 참조·getter 예외에도 죽지 않는 최선의 문자열화. */
const stringify = (value: unknown): string => {
  try {
    const json = JSON.stringify(value);
    if (json !== undefined && json !== '{}') {
      return json;
    }
  } catch {
    // 순환 참조 등 — String()으로 폴백
  }
  return String(value);
};

/** `{ message: '...' }` 형태에서 메시지를 꺼낸다. */
const readMessage = (value: unknown): string | undefined => {
  if (typeof value !== 'object' || value === null || !('message' in value)) {
    return undefined;
  }

  const { message } = value as { message: unknown };
  return typeof message === 'string' && message.length > 0 ? message : undefined;
};

/**
 * 던져진 값에서 사람이 읽을 메시지를 뽑는다.
 *
 * `Error`가 아니어도 동작해야 한다 — 벤더 에러를 메시지로 판별하는 경계에서 쓴다.
 */
export const errorMessageOf = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  return readMessage(value) ?? stringify(value);
};

/**
 * 던져진 값을 `Error`로 정규화한다. 원본은 `cause`로 보존한다.
 *
 * `ErrorReporter.captureException`은 `Error`를 요구한다. 감싸는 과정에서
 * 원본을 잃으면 Sentry 이슈에 남는 것이 껍데기뿐이다.
 */
export const toError = (value: unknown): Error => {
  if (value instanceof Error) {
    return value;
  }

  const error = new Error(errorMessageOf(value));
  // `new Error(msg, { cause })`는 Hermes가 무시할 수 있어 직접 대입한다.
  error.cause = value;
  return error;
};
