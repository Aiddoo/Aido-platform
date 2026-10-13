import { createInquiryResponseDto } from '../__tests__/inquiry.factories';
import { toInquiryResult } from './inquiry.mapper';

describe('toInquiryResult', () => {
  test('message 필드 매핑', () => {
    // Given
    const dto = createInquiryResponseDto();

    // When
    const result = toInquiryResult(dto);

    // Then
    expect(result).toEqual({ message: dto.message });
  });

  test('커스텀 메시지 매핑', () => {
    // Given
    const dto = createInquiryResponseDto({ message: '커스텀 메시지' });

    // When
    const result = toInquiryResult(dto);

    // Then
    expect(result.message).toBe('커스텀 메시지');
  });
});
