/** RN 브릿지·서드파티는 Error가 아닌 값을 던지므로 `instanceof Error`가 아니라 내용으로 판단한다 */

/** 순환 참조·getter 예외에도 죽지 않는 최선의 문자열화. */
function stringify(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    if (json != null && json !== '{}') {
      return json;
    }
  } catch {
    // 순환 참조 등 — String()으로 폴백
  }
  return String(value);
}

function getMessage(value: unknown): string | undefined {
  if (typeof value !== 'object' || value == null || !('message' in value)) {
    return undefined;
  }

  const { message } = value;
  return typeof message === 'string' && message.length > 0 ? message : undefined;
}

export function getErrorMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  return getMessage(value) ?? stringify(value);
}

/** `ErrorReporter.captureException`이 Error를 요구하므로 감싸되 원본은 `cause`로 보존한다 */
export function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }

  const error = new Error(getErrorMessage(value));
  // `new Error(msg, { cause })`는 Hermes가 무시할 수 있어 직접 대입한다.
  error.cause = value;
  return error;
}
