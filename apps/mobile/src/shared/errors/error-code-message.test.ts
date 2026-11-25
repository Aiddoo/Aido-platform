import { ErrorCode } from '@aido/api/errors';
import { i18n } from '@src/shared/i18n';

import { findErrorCodeMessage } from './error-code-message';

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('findErrorCodeMessage', () => {
  // 대기 시간·길이는 계약 상수에서 오고, 지금 값으로 그린 문구는 숫자를 카탈로그에 적던 때와 같다
  it.each([
    [ErrorCode.VERIFY_0753, '1분 뒤에 다시 요청해주세요'],
    [ErrorCode.CHEER_1202, '24시간 뒤에 다시 응원할 수 있어요'],
    [ErrorCode.NUDGE_1108, '조금 전에 콕 찔렀어요. 1시간 뒤에 다시 시도해주세요.'],
    ['INVITE_INVALID_CODE', '초대 코드는 영문과 숫자 6자리예요'],
  ])('%s 문구에 지금 값을 넣는다', (code, expected) => {
    // When
    const message = findErrorCodeMessage(code);

    // Then
    expect(message).toBe(expected);
  });

  // en VERIFY_0753는 `_one`·`_other`만 있어 count 없이 존재를 물으면 못 찾는다
  it('영어는 복수형 키만 있어도 찾고 값에 맞는 단수형을 고른다', async () => {
    // Given
    await i18n.changeLanguage('en');

    // When
    const message = findErrorCodeMessage(ErrorCode.VERIFY_0753);

    // Then
    expect(message).toBe('Please try again in 1 minute');
  });

  it('숫자가 없는 문구는 그대로 찾고 모르는 코드는 null이다', () => {
    // When
    const known = findErrorCodeMessage(ErrorCode.TODO_0801);
    const unknown = findErrorCodeMessage('UNKNOWN_CODE');

    // Then
    expect(known).toBe('할 일을 찾을 수 없어요');
    expect(unknown).toBeNull();
  });
});
