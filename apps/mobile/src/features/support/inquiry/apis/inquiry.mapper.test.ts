import { createInquiryResponseDto } from '../__tests__/inquiry.fixtures';
import { inquiryResultSchema } from '../domains/inquiry.model';
import { toInquiryResult } from './inquiry.mapper';

describe('toInquiryResult', () => {
  it('접수 응답을 앱 모델로 바꾼다', () => {
    // Given
    const dto = createInquiryResponseDto({ message: '접수됐어요' });

    // When
    const result = toInquiryResult(dto);

    // Then
    expect(inquiryResultSchema.parse(result)).toEqual({ message: '접수됐어요' });
  });
});
