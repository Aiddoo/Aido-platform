import { errorMessageOf, toError } from './to-error';

describe('toError — 던져진 값을 Error로 정규화한다', () => {
  it('Error는 그대로 통과시킨다 (스택 보존)', () => {
    // Given
    const original = new Error('boom');

    // When & Then — 감싸면 원본 스택을 잃는다
    expect(toError(original)).toBe(original);
  });

  it('Error 서브클래스도 그대로 통과시킨다', () => {
    // Given
    class CodedError extends Error {}
    const original = new CodedError('coded');

    // When & Then
    expect(toError(original)).toBe(original);
  });

  it('{ message } 형태의 평범한 객체에서 메시지를 살린다', () => {
    // Given — RN 네이티브 브릿지가 Error가 아닌 값을 던지는 경우.
    // String(value)로 감싸면 "[object Object]"가 되어 리포터에 내용이 사라진다.
    const thrown = { message: 'User interaction is not allowed.', code: 'ERR_KEY_CHAIN' };

    // When
    const error = toError(thrown);

    // Then
    expect(error.message).toBe('User interaction is not allowed.');
    expect(error.message).not.toContain('[object Object]');
  });

  it('원본을 cause로 보존한다', () => {
    // Given
    const thrown = { message: 'native failure', code: 'ERR_X' };

    // When
    const error = toError(thrown);

    // Then — Sentry 이슈에 껍데기만 남지 않게
    expect(error.cause).toBe(thrown);
  });

  it('문자열을 던져도 메시지가 된다', () => {
    // Given & When & Then
    expect(toError('plain string').message).toBe('plain string');
  });
});

describe('errorMessageOf — 값의 모양이 아니라 내용으로 판단한다', () => {
  it.each([
    ['Error', new Error('from error'), 'from error'],
    ['문자열', 'from string', 'from string'],
    ['message 객체', { message: 'from object' }, 'from object'],
  ])('%s에서 메시지를 뽑는다', (_label, value, expected) => {
    // Given & When & Then
    expect(errorMessageOf(value)).toBe(expected);
  });

  it('message가 없는 객체는 JSON으로 직렬화한다 ([object Object] 금지)', () => {
    // Given
    const value = { code: 'ERR_X', status: 500 };

    // When
    const message = errorMessageOf(value);

    // Then
    expect(message).toBe('{"code":"ERR_X","status":500}');
    expect(message).not.toBe('[object Object]');
  });

  it('빈 문자열 message는 무시하고 직렬화로 폴백한다', () => {
    // Given
    const value = { message: '', code: 'ERR_X' };

    // When & Then
    expect(errorMessageOf(value)).toBe('{"message":"","code":"ERR_X"}');
  });

  it('순환 참조에도 죽지 않는다', () => {
    // Given
    const value: Record<string, unknown> = { code: 'ERR_X' };
    value.self = value;

    // When & Then — JSON.stringify가 던지므로 String()으로 폴백
    expect(() => errorMessageOf(value)).not.toThrow();
    expect(errorMessageOf(value)).toBe('[object Object]');
  });

  it.each([
    [null, 'null'],
    [undefined, 'undefined'],
    [42, '42'],
  ])('원시값(%p)도 문자열로 만든다', (value, expected) => {
    // Given & When & Then
    expect(errorMessageOf(value)).toBe(expected);
  });
});
