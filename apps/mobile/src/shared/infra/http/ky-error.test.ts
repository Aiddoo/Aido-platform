import { ErrorCode } from '@aido/api/errors';
import { i18n } from '@src/shared/i18n';

import { resolveMessage } from './ky-error';

describe('resolveMessage (KyHttpClient의 4xx → ApiError 분기에서 사용)', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('알려진 코드는 서버 메시지 대신 카탈로그 문구를 사용한다', () => {
    // When
    const message = resolveMessage('TODO_0801', '서버의 포멀한 메시지');

    // Then
    expect(message).toBe('할 일을 찾을 수 없어요');
  });

  it('en에서는 같은 코드가 영어 문구로 번역된다', async () => {
    // Given
    await i18n.changeLanguage('en');

    // When
    const message = resolveMessage('TODO_0801', '서버의 포멀한 메시지');

    // Then
    expect(message).toBe('To-do not found');
  });

  it('보안 마스킹 그룹(EMAIL_0502/0507)은 두 언어 모두 동일 문구를 사용한다', async () => {
    // When
    const koMasked = resolveMessage(ErrorCode.EMAIL_0502, '');
    const koOther = resolveMessage(ErrorCode.EMAIL_0507, '');
    await i18n.changeLanguage('en');
    const enMasked = resolveMessage(ErrorCode.EMAIL_0502, '');
    const enOther = resolveMessage(ErrorCode.EMAIL_0507, '');

    // Then
    expect(koMasked).toBe(koOther);
    expect(enMasked).toBe(enOther);
  });

  it('미지 코드는 서버 메시지, 그것도 없으면 폴백을 사용한다', () => {
    // When
    const serverMessage = resolveMessage('UNKNOWN_9999', '서버가 내려준 메시지');
    const fallback = resolveMessage('UNKNOWN_9999', '');

    // Then
    expect(serverMessage).toBe('서버가 내려준 메시지');
    expect(fallback).toBe('문제가 생겼어요');
  });
});
