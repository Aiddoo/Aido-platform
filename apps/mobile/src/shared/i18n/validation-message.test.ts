import { i18n } from '@src/shared/i18n';

import { resolveValidationMessage } from './validation-message';

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('resolveValidationMessage', () => {
  // 한도는 계약 상수에서 오고, 지금 값으로 그린 문구는 숫자를 카탈로그에 적던 때와 같다
  it.each([
    ['nickname.tooLong', '이름은 20자 이내로 입력해주세요'],
    ['categoryName.tooLong', '카테고리 이름은 50자 이내로 입력해주세요'],
    ['todoTitle.tooLong', '제목은 200자 이내로 입력해주세요'],
    ['inquiryContent.tooShort', '내용은 10자 이상 입력해주세요'],
    ['inquiryContent.tooLong', '내용은 2000자 이내로 입력해주세요'],
    ['userTag.length', '해시태그는 8자리예요'],
  ])('%s 문구에 지금 한도를 넣는다', (key, expected) => {
    // When
    const message = resolveValidationMessage({ type: 'too_big' }, { default: key });

    // Then
    expect(message).toBe(expected);
  });

  it('영어도 같은 한도를 넣는다', async () => {
    // Given
    await i18n.changeLanguage('en');

    // When
    const message = resolveValidationMessage({ type: 'too_big' }, { default: 'comment.tooLong' });

    // Then
    expect(message).toBe('Use up to 500 characters for your comment');
  });

  it('천 단위 한도는 en에서만 구분 기호를 넣고 ko는 전처럼 붙여 쓴다', async () => {
    // Given
    const keys = { default: 'inquiryContent.tooLong' };

    // When
    const korean = resolveValidationMessage({ type: 'too_big' }, keys);
    await i18n.changeLanguage('en');
    const english = resolveValidationMessage({ type: 'too_big' }, keys);

    // Then
    expect(korean).toBe('내용은 2000자 이내로 입력해주세요');
    expect(english).toBe('Use up to 2,000 characters');
  });

  it('이슈 타입에 맞는 키가 없으면 기본 키 문구를 한도와 함께 쓴다', () => {
    // When
    const message = resolveValidationMessage(
      { type: 'too_small' },
      { default: 'email.tooLong', byType: { too_small: 'email.missingKey' } },
    );

    // Then
    expect(message).toBe('이메일은 255자 이내로 입력해주세요');
  });
});
