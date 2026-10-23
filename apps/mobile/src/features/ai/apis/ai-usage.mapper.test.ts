import { createAiUsageResponseDto } from '../__tests__/ai-usage.factories';
import { toAiUsage } from './ai-usage.mapper';

describe('toAiUsage', () => {
  test('사용량을 추출하고 초기화 시각을 Date로 변환한다', () => {
    // Given
    const dto = createAiUsageResponseDto();

    // When
    const result = toAiUsage(dto);

    // Then
    expect(result).toEqual({
      used: 3,
      limit: 10,
      resetsAt: new Date('2026-03-09T00:00:00.000Z'),
    });
  });
});
