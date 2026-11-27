import { normalizeInviteCodeInput, normalizePastedInviteCode } from './invite-code-form.schema';

describe('normalizeInviteCodeInput', () => {
  it('붙여 넣은 공백·하이픈·소문자를 서버 형태로 맞춘 값을 반환한다', () => {
    // When
    const result = normalizeInviteCodeInput(' k7m-2 qx ');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it('6자를 넘으면 앞 6자만 반환한다', () => {
    // When
    const result = normalizeInviteCodeInput('K7M2QXZZ');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it('전각 영숫자와 전각 하이픈을 반각으로 바꾼 값을 반환한다', () => {
    // When
    const result = normalizeInviteCodeInput('ｋ７ｍ－２ＱＸ');

    // Then
    // NFKC: ｋ→k, ７→7, －→- 뒤 하이픈 제거·대문자
    expect(result).toBe('K7M2QX');
  });
});

describe('normalizePastedInviteCode', () => {
  it('빈 칸에 붙여 넣으면 공백·하이픈·소문자를 맞춘 코드를 반환한다', () => {
    // When
    const result = normalizePastedInviteCode('', ' k7m-2qx ');

    // Then
    expect(result).toBe('K7M2QX');
  });

  it.each([
    ['끝에', 'ABCDEFK7M2QX'],
    ['가운데에', 'ABCK7M2QXDEF'],
    ['앞에', 'K7M2QXABCDEF'],
  ])('채운 코드 %s 붙여 넣으면 붙여 넣은 코드로 바꾼다', (_position, next) => {
    // When
    const result = normalizePastedInviteCode('ABCDEF', next);

    // Then
    expect(result).toBe('K7M2QX');
  });

  it('붙여 넣은 글자가 코드보다 짧으면 쓰던 코드에 이어 붙인다', () => {
    // When
    const result = normalizePastedInviteCode('K7', 'K7m-2qx');

    // Then
    // 붙여 넣은 'm-2qx'는 정규화하면 4자라 코드 하나를 채우지 못한다
    expect(result).toBe('K7M2QX');
  });
});
