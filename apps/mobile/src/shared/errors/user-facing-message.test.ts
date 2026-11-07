import { ApiError } from '@src/core/errors/api-error';

import { BusinessError } from './business-error';
import { NetworkError, ParseError } from './infra-error';
import { getUserFacingMessage } from './user-facing-message';

describe('getUserFacingMessage — 토스트에 그대로 보여 줄 오류 문구', () => {
  it('서버 BusinessError 메시지는 그대로 쓴다', () => {
    // Given
    const error = new ApiError('INQUIRY_2001', '문의 내용을 확인해 주세요', 400);

    // When & Then
    expect(getUserFacingMessage(error)).toBe('문의 내용을 확인해 주세요');
  });

  it('앱 BusinessError는 errors 카탈로그의 코드 문구를 쓴다', () => {
    // Given
    const error = new BusinessError('FRIEND_EMPTY_TAG');

    // When & Then
    expect(getUserFacingMessage(error)).toBe('해시태그를 입력해주세요');
  });

  it('카탈로그에 없는 앱 BusinessError 코드는 숨긴다', () => {
    // When & Then
    expect(getUserFacingMessage(new BusinessError('UNKNOWN_CODE'))).toBeUndefined();
  });

  it('번역된 통신 오류 메시지는 그대로 쓴다', () => {
    // Given
    const error = new NetworkError();

    // When & Then
    expect(getUserFacingMessage(error)).toBe(error.message);
  });

  it('ParseError의 개발자용 검증 메시지는 숨긴다', () => {
    // Given
    const error = new ParseError('[InquiryService] Invalid createInquiry response: id required');

    // When & Then
    expect(getUserFacingMessage(error)).toBeUndefined();
  });

  it('코드 없는 일반 Error는 숨긴다', () => {
    // When & Then
    expect(
      getUserFacingMessage(new TypeError("Cannot read properties of undefined (reading 'id')")),
    ).toBeUndefined();
  });
});
