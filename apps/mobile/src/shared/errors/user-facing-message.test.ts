import { ApiError } from './api-error';
import { NetworkError, ParseError } from './infra-error';
import { userFacingMessageOf } from './user-facing-message';

describe('userFacingMessageOf — 토스트에 그대로 보여 줄 오류 문구', () => {
  it('서버 BusinessError 메시지는 그대로 쓴다', () => {
    // Given
    const error = new ApiError('INQUIRY_2001', '문의 내용을 확인해 주세요', 400);

    // When & Then
    expect(userFacingMessageOf(error)).toBe('문의 내용을 확인해 주세요');
  });

  it('번역된 통신 오류 메시지는 그대로 쓴다', () => {
    // Given
    const error = new NetworkError();

    // When & Then
    expect(userFacingMessageOf(error)).toBe(error.message);
  });

  it('ParseError의 개발자용 검증 메시지는 숨긴다', () => {
    // Given
    const error = new ParseError('[InquiryService] Invalid createInquiry response: id required');

    // When & Then
    expect(userFacingMessageOf(error)).toBeUndefined();
  });

  it('코드 없는 일반 Error는 숨긴다', () => {
    // When & Then
    expect(
      userFacingMessageOf(new TypeError("Cannot read properties of undefined (reading 'id')")),
    ).toBeUndefined();
  });
});
