import { createParseMemoResponseDto } from '../__tests__/parsed-memo.factories';
import { toParsedMemoResult } from './ai.mapper';

describe('toParsedMemoResult', () => {
  test('할 일과 서버가 센 남은 할 일 수를 그대로 옮긴다', () => {
    // Given
    const dto = createParseMemoResponseDto();
    const withOmitted = createParseMemoResponseDto({
      meta: { ...dto.meta, omittedTodoCount: 7 },
    });

    // When
    const result = toParsedMemoResult(withOmitted);

    // Then
    expect(result.todos).toEqual(dto.data.todos);
    expect(result.omittedTodoCount).toBe(7);
  });

  test('omittedTodoCount가 없는 구 서버 응답은 0개로 본다', () => {
    // Given
    const dto = createParseMemoResponseDto();

    // When
    const result = toParsedMemoResult(dto);

    // Then
    expect(result.omittedTodoCount).toBe(0);
  });
});
