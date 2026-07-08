import { toServerErrorCode } from './server-error-code';

describe('toServerErrorCode', () => {
  it('서버 envelope의 알려진 ErrorCode를 뽑는다', () => {
    // Given — 토큰 재사용 감지: 단순 만료와 구분되어야 하는 보안 이벤트
    const body = { error: { code: 'SESSION_0704', message: '토큰 재사용이 감지되었습니다.' } };

    // When & Then
    expect(toServerErrorCode(body)).toBe('SESSION_0704');
  });

  it('알 수 없는 코드는 undefined를 반환한다', () => {
    // Given — 서버가 새 코드를 추가해도 클라가 깨지지 않아야 한다
    const body = { error: { code: 'NOT_A_REAL_CODE', message: 'x' } };

    // When & Then
    expect(toServerErrorCode(body)).toBeUndefined();
  });

  it.each([
    [null],
    [undefined],
    [{}],
    ['plain text'],
    [{ error: {} }],
  ])('envelope가 아니면 undefined를 반환한다 (%p)', (body) => {
    // Given & When & Then
    expect(toServerErrorCode(body)).toBeUndefined();
  });
});
