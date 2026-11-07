import { createMemo } from '../__tests__/memo.fixtures';
import { toMemoPreview } from './memo.view-model';

describe('toMemoPreview', () => {
  it('첫 줄을 제목으로, 나머지를 본문으로 나눈다', () => {
    // Given
    const memo = createMemo({ content: ' 장보기 \n우유\n계란' });

    // When
    const preview = toMemoPreview(memo);

    // Then
    expect(preview).toEqual({ title: '장보기', body: '우유\n계란' });
  });
});
